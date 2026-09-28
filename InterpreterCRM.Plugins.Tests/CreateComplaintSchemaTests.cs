using System;
using System.Collections.Generic;
using System.Linq;
using InterpreterCRM.SchemaSetup;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Moq;
using Xunit;

namespace InterpreterCRM.Plugins.Tests
{
    public sealed class CreateComplaintSchemaTests
    {
        [Fact]
        public void CreatesRequestedSchemaAndRerunOnlyPublishes()
        {
            var test = new Harness();
            test.Run();
            Assert.Equal(28, test.Complaint.Attributes.Length);
            Assert.Equal("gsic_referencenumber", test.Complaint.PrimaryNameAttribute);
            Assert.Equal(10, test.Complaint.Attributes.OfType<DateTimeAttributeMetadata>().Count());
            Assert.All(test.Complaint.Attributes.OfType<DateTimeAttributeMetadata>(), date =>
            {
                Assert.Equal(DateTimeFormat.DateOnly, date.Format);
                Assert.Equal(DateTimeBehavior.DateOnly.Value, date.DateTimeBehavior.Value);
            });
            Assert.Equal("gsic_datereceived", Assert.Single(test.Complaint.Attributes, a => a.RequiredLevel.Value == AttributeRequiredLevel.ApplicationRequired).LogicalName);
            Assert.Equal(7, test.Complaint.Attributes.OfType<BooleanAttributeMetadata>().Count());
            Assert.Equal(7, test.Complaint.Attributes.OfType<StringAttributeMetadata>().Count());
            Assert.Single(test.Complaint.Attributes.OfType<MemoAttributeMetadata>());
            Assert.Equal(new[] { "gsic_interpreter", "gsic_interpreterlanguage" }, test.Complaint.ManyToOneRelationships.Select(r => r.ReferencedEntity));
            Assert.All(test.Complaint.ManyToOneRelationships, r => Assert.Equal(CascadeType.RemoveLink, r.CascadeConfiguration.Delete));
            Assert.Equal(new[] { "Warning Letter", "In-person Re-training", "Dismissed" }, test.Result.OptionSet.Options.Select(o => o.Label.LocalizedLabels[0].Label));
            Assert.Equal(new int?[] { 472540000, 472540001, 472540002 }, test.Result.OptionSet.Options.Select(o => o.Value));
            Assert.All(test.Writes.Where(r => r is CreateEntityRequest || r is CreateAttributeRequest || r is CreateOneToManyRequest), r => Assert.Equal("test_solution", r["SolutionUniqueName"]));

            test.Writes.Clear();
            test.Run();
            var publish = Assert.IsType<PublishXmlRequest>(Assert.Single(test.Writes));
            Assert.Contains("<entity>gsic_complaint</entity>", publish.ParameterXml);
            Assert.Contains(test.Log, line => line.StartsWith("Already Exists: gsic_complaint"));
        }

        [Fact]
        public void ResumesPartialCreationAfterServiceFailure()
        {
            var test = new Harness { FailOn = "gsic_incidentdate" };
            Assert.Throws<InvalidOperationException>(() => test.Run());
            Assert.DoesNotContain(test.Writes, r => r is PublishXmlRequest);
            Assert.Contains(test.Log, l => l.StartsWith("Failed: gsic_incidentdate"));
            test.FailOn = null;
            test.Writes.Clear();
            test.Run();
            Assert.Equal(28, test.Complaint.Attributes.Length);
            Assert.DoesNotContain(test.Writes, r => r is CreateEntityRequest);
        }

        [Fact]
        public void AddsMissingInitialChoiceAndPreservesClientAdditionsAndExistingValues()
        {
            var test = new Harness();
            test.Run();
            test.Result.OptionSet.Options.RemoveAt(1);
            test.Result.OptionSet.Options[0].Value = 123;
            test.Result.OptionSet.Options.Add(new OptionMetadata(new Label("Client supplied result", 1033), 987));
            test.Writes.Clear();
            test.Run();
            Assert.Single(test.Writes.OfType<InsertOptionValueRequest>());
            Assert.Contains(test.Result.OptionSet.Options, o => o.Value == 987);
            Assert.Contains(test.Result.OptionSet.Options, o => o.Value == 123);
            Assert.Equal(4, test.Result.OptionSet.Options.Count);
        }

        [Theory]
        [InlineData("date")]
        [InlineData("type")]
        [InlineData("lookup")]
        [InlineData("choice")]
        public void ConflictingExistingMetadataFailsBeforeAnyWrite(string conflict)
        {
            var test = new Harness();
            test.Run();
            if (conflict == "date") ((DateTimeAttributeMetadata)test.Complaint.Attributes.Single(a => a.LogicalName == "gsic_datereceived")).DateTimeBehavior = DateTimeBehavior.UserLocal;
            if (conflict == "type")
            {
                var attributes = test.Complaint.Attributes.Where(a => a.LogicalName != "gsic_type").ToList();
                attributes.Add(new IntegerAttributeMetadata { LogicalName = "gsic_type" });
                Set(test.Complaint, "Attributes", attributes.ToArray());
            }
            if (conflict == "lookup") ((LookupAttributeMetadata)test.Complaint.Attributes.Single(a => a.LogicalName == "gsic_interpreter")).Targets = new[] { "contact" };
            if (conflict == "choice") test.Result.OptionSet.Options[0].Label = new Label("Different meaning", 1033);
            test.Writes.Clear();
            Assert.Throws<InvalidOperationException>(() => test.Run());
            Assert.Empty(test.Writes);
        }

        [Fact]
        public void MissingTargetFailsBeforeCreatingComplaint()
        {
            var test = new Harness();
            test.Tables.Remove("gsic_interpreterlanguage");
            Assert.Throws<InvalidOperationException>(() => test.Run());
            Assert.Empty(test.Writes);
        }

        [Fact]
        public void MetadataReadFailureIsNeverTreatedAsMissingTable()
        {
            var test = new Harness();
            test.Service.Setup(s => s.Execute(It.IsAny<RetrieveAllEntitiesRequest>())).Throws(new InvalidOperationException("Read failed"));
            Assert.Throws<InvalidOperationException>(() => test.Run());
            Assert.Empty(test.Writes);
        }

        [Theory]
        [InlineData(true, "gsic")]
        [InlineData(false, "other")]
        public void RejectsManagedSolutionOrWrongPublisher(bool managed, string prefix)
        {
            var test = new Harness();
            test.Solution["ismanaged"] = managed;
            test.Publisher["customizationprefix"] = prefix;
            Assert.Throws<InvalidOperationException>(() => test.Run());
            Assert.Empty(test.Writes);
        }

        [Fact]
        public void RerunRetriesFailedPublicationWithoutRecreatingMetadata()
        {
            var test = new Harness { FailOn = "publish" };
            Assert.Throws<InvalidOperationException>(() => test.Run());
            test.FailOn = null;
            test.Writes.Clear();
            test.Run();
            Assert.IsType<PublishXmlRequest>(Assert.Single(test.Writes));
        }

        // SDK metadata response properties are read-only to consumers; simulate server responses.
        private static void Set(object target, string property, object value)
            => target.GetType().GetProperty(property).SetValue(target, value);

        private sealed class Harness
        {
            public Mock<IOrganizationService> Service { get; } = new Mock<IOrganizationService>(MockBehavior.Strict);
            public Dictionary<string, EntityMetadata> Tables { get; } = new Dictionary<string, EntityMetadata>();
            public List<OrganizationRequest> Writes { get; } = new List<OrganizationRequest>();
            public List<string> Log { get; } = new List<string>();
            public Entity Solution { get; } = new Entity("solution", Guid.NewGuid());
            public Entity Publisher { get; } = new Entity("publisher", Guid.NewGuid());
            public string FailOn { get; set; }
            public EntityMetadata Complaint => Tables[CreateComplaintSchema.Table];
            public PicklistAttributeMetadata Result => Complaint.Attributes.OfType<PicklistAttributeMetadata>().Single();
            private bool member;

            public Harness()
            {
                foreach (var name in new[] { "gsic_interpreter", "gsic_interpreterlanguage" })
                    Tables.Add(name, new EntityMetadata { LogicalName = name, SchemaName = name, MetadataId = Guid.NewGuid() });
                Solution["publisherid"] = Publisher.ToEntityReference();
                Solution["ismanaged"] = false;
                Publisher["customizationprefix"] = "gsic";
                Publisher["customizationoptionvalueprefix"] = 47254;
                Service.Setup(s => s.Retrieve("publisher", Publisher.Id, It.IsAny<ColumnSet>())).Returns(Publisher);
                Service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>())).Returns<QueryBase>(query =>
                {
                    var q = (QueryExpression)query;
                    if (q.EntityName == "solution") return new EntityCollection(new[] { Solution });
                    Assert.Equal("solutioncomponent", q.EntityName);
                    return new EntityCollection(member ? new[] { new Entity("solutioncomponent", Guid.NewGuid()) } : Array.Empty<Entity>());
                });
                Service.Setup(s => s.Execute(It.IsAny<OrganizationRequest>())).Returns<OrganizationRequest>(Execute);
            }

            public void Run() => new CreateComplaintSchema(Service.Object, Log.Add).Run("test_solution");

            private OrganizationResponse Execute(OrganizationRequest request)
            {
                if (request is RetrieveAllEntitiesRequest all)
                {
                    Assert.True(all.RetrieveAsIfPublished);
                    return new RetrieveAllEntitiesResponse { Results = new ParameterCollection { ["EntityMetadata"] = Tables.Values.ToArray() } };
                }
                if (request is RetrieveEntityRequest get)
                {
                    Assert.True(get.RetrieveAsIfPublished);
                    return new RetrieveEntityResponse { Results = new ParameterCollection { ["EntityMetadata"] = Tables[get.LogicalName] } };
                }
                if (request is CreateAttributeRequest attribute && attribute.Attribute.LogicalName == FailOn)
                    throw new InvalidOperationException("Simulated attribute creation failure");
                if (request is PublishXmlRequest && FailOn == "publish") throw new InvalidOperationException("Simulated publish failure");
                Writes.Add(request);
                if (request is CreateEntityRequest create)
                {
                    var entity = create.Entity;
                    entity.LogicalName = CreateComplaintSchema.Table;
                    entity.MetadataId = Guid.NewGuid();
                    Set(entity, "PrimaryNameAttribute", create.PrimaryAttribute.LogicalName);
                    Set(entity, "Attributes", new AttributeMetadata[] { create.PrimaryAttribute });
                    Set(entity, "ManyToOneRelationships", Array.Empty<OneToManyRelationshipMetadata>());
                    Tables.Add(entity.LogicalName, entity);
                }
                else if (request is CreateAttributeRequest add)
                {
                    Assert.Equal(CreateComplaintSchema.Table, add.EntityName);
                    Set(Complaint, "Attributes", Complaint.Attributes.Concat(new[] { add.Attribute }).ToArray());
                }
                else if (request is CreateOneToManyRequest relationship)
                {
                    relationship.Lookup.Targets = new[] { relationship.OneToManyRelationship.ReferencedEntity };
                    relationship.OneToManyRelationship.ReferencingAttribute = relationship.Lookup.LogicalName;
                    Set(Complaint, "Attributes", Complaint.Attributes.Concat(new[] { relationship.Lookup }).ToArray());
                    Set(Complaint, "ManyToOneRelationships", Complaint.ManyToOneRelationships.Concat(new[] { relationship.OneToManyRelationship }).ToArray());
                }
                else if (request is InsertOptionValueRequest option)
                    Result.OptionSet.Options.Add(new OptionMetadata(option.Label, option.Value));
                else if (request is AddSolutionComponentRequest) member = true;
                else Assert.IsType<PublishXmlRequest>(request);
                return new OrganizationResponse();
            }
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Existing = InterpreterCRM.Plugins.DataverseSchema;

namespace InterpreterCRM.SchemaSetup
{
    /// <summary>Additive metadata setup. Never updates or deletes existing metadata.</summary>
    public sealed class CreateComplaintSchema
    {
        public const string Table = "gsic_complaint";
        private const int English = 1033;
        private readonly IOrganizationService service;
        private readonly Action<string> log;

        public CreateComplaintSchema(IOrganizationService service, Action<string> log)
        {
            this.service = service ?? throw new ArgumentNullException(nameof(service));
            this.log = log ?? throw new ArgumentNullException(nameof(log));
        }

        public void Run(string solutionUniqueName)
        {
            string component = "preflight";
            try
            {
                var solution = FindSolution(solutionUniqueName);
                var publisher = service.Retrieve("publisher", solution.GetAttributeValue<EntityReference>("publisherid").Id,
                    new ColumnSet("customizationprefix", "customizationoptionvalueprefix"));
                Require(publisher.GetAttributeValue<string>("customizationprefix") == "gsic", "Solution publisher prefix must be gsic.");
                Require(publisher.Contains("customizationoptionvalueprefix"), "Publisher choice value prefix is missing.");
                int optionBase = checked(publisher.GetAttributeValue<int>("customizationoptionvalueprefix") * 10000);

                // Enumerate table metadata so permission/transport failures are never mistaken for absence.
                var tables = ((RetrieveAllEntitiesResponse)service.Execute(new RetrieveAllEntitiesRequest
                {
                    EntityFilters = EntityFilters.Entity,
                    RetrieveAsIfPublished = true
                })).EntityMetadata;
                var targets = new[] { Existing.Interpreter.Table, Existing.InterpreterLanguage.Table };
                foreach (var target in targets)
                {
                    Require(tables.Any(t => t.LogicalName == target), "Required lookup target is missing: " + target);
                    var metadata = RetrieveTable(target);
                    log("Already Exists: target " + metadata.LogicalName + " (schema " + metadata.SchemaName + ")");
                }

                var existing = tables.Any(t => t.LogicalName == Table) ? RetrieveTable(Table) : null;
                var columns = Columns(optionBase).ToArray();
                var relationships = Relationships().ToArray();
                // Check all existing components before the first mutation. Incompatible metadata needs human review.
                if (existing != null)
                {
                    Require(existing.IsManaged != true, "Existing Complaint table is managed.");
                    Require(existing.PrimaryNameAttribute == "gsic_referencenumber", "Existing Complaint primary name differs from Reference Number.");
                    foreach (var column in columns)
                    {
                        var found = FindAttribute(existing, column.LogicalName);
                        if (found != null)
                        {
                            component = column.LogicalName;
                            ValidateColumn(found, column);
                        }
                    }

                    foreach (var relationship in relationships)
                    {
                        component = relationship.Lookup.LogicalName;
                        ValidateLookup(existing, relationship);
                    }
                }

                component = Table;
                if (existing == null)
                {
                    service.Execute(new CreateEntityRequest
                    {
                        Entity = new EntityMetadata
                        {
                            SchemaName = "gsic_Complaint",
                            DisplayName = Label("Complaint"),
                            DisplayCollectionName = Label("Complaints"),
                            OwnershipType = OwnershipTypes.UserOwned,
                            IsActivity = false
                        },
                        PrimaryAttribute = (StringAttributeMetadata)columns[0],
                        HasActivities = false,
                        HasNotes = false,
                        SolutionUniqueName = solutionUniqueName
                    });
                    log("Created: " + Table);
                    log("Created: gsic_referencenumber (primary name)");
                    existing = RetrieveTable(Table);
                }
                else
                {
                    log("Already Exists: " + Table);
                }

                foreach (var column in columns)
                {
                    component = column.LogicalName;
                    var found = FindAttribute(existing, column.LogicalName);
                    if (found == null)
                    {
                        service.Execute(new CreateAttributeRequest { EntityName = Table, Attribute = column, SolutionUniqueName = solutionUniqueName });
                        log("Created: " + component);
                        if (column is PicklistAttributeMetadata createdChoice)
                            foreach (var option in createdChoice.OptionSet.Options)
                                log("Created: choice " + option.Label.LocalizedLabels[0].Label);
                    }
                    else
                    {
                        log("Already Exists: " + component);
                        if (column is PicklistAttributeMetadata expectedChoice)
                            EnsureOptions((PicklistAttributeMetadata)found, expectedChoice, solutionUniqueName);
                    }
                }

                foreach (var relationship in relationships)
                {
                    component = relationship.OneToManyRelationship.SchemaName;
                    if (FindAttribute(existing, relationship.Lookup.LogicalName) == null)
                    {
                        relationship.SolutionUniqueName = solutionUniqueName;
                        service.Execute(relationship);
                        log("Created: lookup " + relationship.Lookup.LogicalName + " / relationship " + component);
                    }
                    else
                    {
                        log("Already Exists: lookup " + relationship.Lookup.LogicalName + " / relationship to " + relationship.OneToManyRelationship.ReferencedEntity);
                    }
                }

                component = "solution membership";
                var membership = new QueryExpression("solutioncomponent") { ColumnSet = new ColumnSet("solutioncomponentid"), TopCount = 1 };
                membership.Criteria.AddCondition("solutionid", ConditionOperator.Equal, solution.Id);
                membership.Criteria.AddCondition("componenttype", ConditionOperator.Equal, 1);
                membership.Criteria.AddCondition("objectid", ConditionOperator.Equal, existing.MetadataId.Value);
                if (service.RetrieveMultiple(membership).Entities.Count == 0)
                {
                    service.Execute(new AddSolutionComponentRequest
                    {
                        ComponentId = existing.MetadataId.Value,
                        ComponentType = 1,
                        SolutionUniqueName = solutionUniqueName,
                        AddRequiredComponents = false,
                        DoNotIncludeSubcomponents = false
                    });
                    log("Created: Complaint membership in " + solutionUniqueName);
                }
                else log("Already Exists: Complaint membership in " + solutionUniqueName);

                component = "publish";
                // Publish even on a no-op rerun, allowing recovery after an earlier publish failure.
                // Relationships affect both ends; publish these three tables, not all customizations.
                service.Execute(new PublishXmlRequest
                {
                    ParameterXml = "<importexportxml><entities><entity>" + Table + "</entity><entity>" + targets[0] +
                        "</entity><entity>" + targets[1] + "</entity></entities></importexportxml>"
                });
                log("Published: Complaint and the two relationship target tables.");
            }
            catch (Exception exception)
            {
                log("Failed: " + component + " (" + exception.GetType().Name + "). " +
                    (exception is InvalidOperationException ? exception.Message : "Dataverse request failed; no existing metadata was overwritten. Inspect the server fault with your administrator."));
                throw;
            }
        }

        private Entity FindSolution(string uniqueName)
        {
            Require(!string.IsNullOrWhiteSpace(uniqueName), "Solution unique name is required.");
            var query = new QueryExpression("solution") { ColumnSet = new ColumnSet("publisherid", "ismanaged"), TopCount = 2 };
            query.Criteria.AddCondition("uniquename", ConditionOperator.Equal, uniqueName);
            var found = service.RetrieveMultiple(query).Entities;
            Require(found.Count == 1 && !found[0].GetAttributeValue<bool>("ismanaged"), "Specify one existing unmanaged solution by its unique name.");
            return found[0];
        }

        private EntityMetadata RetrieveTable(string logicalName)
        {
            return ((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest
            {
                LogicalName = logicalName,
                EntityFilters = EntityFilters.Entity | EntityFilters.Attributes | EntityFilters.Relationships,
                RetrieveAsIfPublished = true
            })).EntityMetadata;
        }

        private static AttributeMetadata FindAttribute(EntityMetadata entity, string name)
        {
            return (entity.Attributes ?? Array.Empty<AttributeMetadata>()).SingleOrDefault(a => a.LogicalName == name);
        }

        private static void ValidateColumn(AttributeMetadata found, AttributeMetadata expected)
        {
            Require(found.GetType() == expected.GetType(), "Existing column type differs: " + expected.LogicalName);
            Require(found.RequiredLevel?.Value == expected.RequiredLevel.Value, "Existing required level differs: " + expected.LogicalName);
            if (expected is StringAttributeMetadata text)
                Require(((StringAttributeMetadata)found).MaxLength >= text.MaxLength && string.IsNullOrEmpty(((StringAttributeMetadata)found).AutoNumberFormat), "Existing text length or autonumber differs: " + expected.LogicalName);
            if (expected is MemoAttributeMetadata memo)
                Require(((MemoAttributeMetadata)found).MaxLength >= memo.MaxLength, "Existing multiline text length is too short.");
            if (expected is DateTimeAttributeMetadata)
            {
                var date = (DateTimeAttributeMetadata)found;
                Require(date.Format == DateTimeFormat.DateOnly && date.DateTimeBehavior?.Value == DateTimeBehavior.DateOnly.Value,
                    "Existing date must have Date Only format AND behavior: " + expected.LogicalName);
            }
            if (expected is PicklistAttributeMetadata choice)
            {
                var actual = (PicklistAttributeMetadata)found;
                Require(actual.OptionSet != null && actual.OptionSet.IsGlobal == false, "Existing Complaint Result must be a local choice; global metadata is preserved.");
                foreach (var option in choice.OptionSet.Options)
                {
                    if (FindOption(actual, option) != null) continue;
                    Require(!actual.OptionSet.Options.Any(o => o.Value == option.Value), "Complaint Result option value is already used with a different label: " + option.Value);
                }
            }
        }

        private static OptionMetadata FindOption(PicklistAttributeMetadata choice, OptionMetadata expected)
        {
            var label = expected.Label.LocalizedLabels.Single(l => l.LanguageCode == English).Label;
            return choice.OptionSet.Options.FirstOrDefault(o => o.Label.LocalizedLabels.Any(l => l.LanguageCode == English && l.Label == label));
        }

        private void EnsureOptions(PicklistAttributeMetadata actual, PicklistAttributeMetadata expected, string solution)
        {
            foreach (var option in expected.OptionSet.Options)
            {
                var name = option.Label.LocalizedLabels[0].Label;
                if (FindOption(actual, option) != null) log("Already Exists: choice " + name);
                else
                {
                    service.Execute(new InsertOptionValueRequest
                    {
                        EntityLogicalName = Table,
                        AttributeLogicalName = expected.LogicalName,
                        Label = option.Label,
                        Value = option.Value,
                        SolutionUniqueName = solution
                    });
                    log("Created: choice " + name);
                }
            }
        }

        private static void ValidateLookup(EntityMetadata entity, CreateOneToManyRequest expected)
        {
            var found = FindAttribute(entity, expected.Lookup.LogicalName);
            var relations = entity.ManyToOneRelationships ?? Array.Empty<OneToManyRelationshipMetadata>();
            var named = relations.SingleOrDefault(r => string.Equals(r.SchemaName, expected.OneToManyRelationship.SchemaName, StringComparison.OrdinalIgnoreCase));
            var attached = relations.Where(r => r.ReferencingAttribute == expected.Lookup.LogicalName).ToArray();
            if (found == null)
            {
                Require(named == null && attached.Length == 0, "Relationship exists without the expected lookup; manual review required.");
                return;
            }
            var lookup = found as LookupAttributeMetadata;
            Require(lookup != null && lookup.Targets != null && lookup.Targets.SequenceEqual(new[] { expected.OneToManyRelationship.ReferencedEntity }), "Existing lookup target differs: " + expected.Lookup.LogicalName);
            Require(lookup.RequiredLevel?.Value == AttributeRequiredLevel.None, "Existing lookup is required: " + expected.Lookup.LogicalName);
            Require(attached.Length == 1 && attached[0].ReferencedEntity == expected.OneToManyRelationship.ReferencedEntity && attached[0].ReferencingEntity == Table,
                "Existing lookup relationship differs: " + expected.Lookup.LogicalName);
            Require(named == null || named.ReferencingAttribute == expected.Lookup.LogicalName, "Relationship schema name is already used by another lookup.");
        }

        private static IEnumerable<AttributeMetadata> Columns(int optionBase)
        {
            yield return Text("ReferenceNumber", "Reference Number");
            yield return Date("DateReceived", "Date Received", true);
            // Complaint Type values are unresolved. No confirmed choice exists in this repository.
            yield return Text("Type", "Type");
            yield return Text("CourtLocation", "Court Location");
            yield return Date("IncidentDate", "Incident Date");
            // Court Level and Contact By also have no confirmed project choices.
            yield return Text("CourtLevel", "Court Level");
            yield return Boolean("DivorceActProceeding", "Divorce Act Proceeding");
            yield return Configure(new MemoAttributeMetadata { MaxLength = 10000, Format = StringFormat.TextArea }, "IncidentSummary", "Incident Summary");
            yield return Boolean("ComplaintNotification", "Complaint Notification");
            yield return Date("ComplaintNotificationDateSent", "Complaint Notification Date Sent");
            yield return Text("ComplaintNotificationTrackingNumber", "Complaint Notification Tracking Number");
            yield return Boolean("ResponseReceived", "Response Received");
            yield return Date("ResponseDateReceived", "Response Date Received");
            yield return Boolean("ResultNotification", "Result Notification");
            yield return Boolean("NoResponseRequired", "No Response Required");
            yield return Date("ResultNotificationDateSent", "Result Notification Date Sent");
            yield return Text("ResultNotificationTrackingNumber", "Result Notification Tracking Number");
            yield return Text("ContactBy", "Contact By");
            yield return Boolean("Ordered", "Ordered");
            yield return Date("OrderedDateSent", "Ordered Date Sent");
            yield return Boolean("Received", "Received");
            yield return Date("ReceivedDate", "Received Date");
            yield return Date("DateSentToEvaluator", "Date Sent to Evaluator");
            yield return Date("DateEvaluationReceived", "Date Evaluation Received");
            // Initial values only. The client may provide additional Complaint Result values later.
            var options = new OptionSetMetadata { IsGlobal = false, OptionSetType = OptionSetType.Picklist };
            options.Options.Add(new OptionMetadata(Label("Warning Letter"), optionBase));
            options.Options.Add(new OptionMetadata(Label("In-person Re-training"), optionBase + 1));
            options.Options.Add(new OptionMetadata(Label("Dismissed"), optionBase + 2));
            yield return Configure(new PicklistAttributeMetadata { OptionSet = options }, "ComplaintResult", "Complaint Result");
            yield return Date("DateResolvedClosed", "Date Resolved / Closed");
        }

        private static IEnumerable<CreateOneToManyRequest> Relationships()
        {
            yield return Relationship("Interpreter", "Interpreter", Existing.Interpreter.Table, "gsic_Interpreter_Complaints");
            yield return Relationship("InterpreterLanguage", "Language", Existing.InterpreterLanguage.Table, "gsic_InterpreterLanguage_Complaints");
        }

        private static CreateOneToManyRequest Relationship(string suffix, string label, string target, string schema)
        {
            return new CreateOneToManyRequest
            {
                Lookup = Configure(new LookupAttributeMetadata(), suffix, label),
                OneToManyRelationship = new OneToManyRelationshipMetadata
                {
                    SchemaName = schema,
                    ReferencedEntity = target,
                    ReferencingEntity = Table,
                    AssociatedMenuConfiguration = new AssociatedMenuConfiguration { Behavior = AssociatedMenuBehavior.DoNotDisplay },
                    // Non-parental links: deleting a parent only clears the lookup; no child record cascades.
                    CascadeConfiguration = new CascadeConfiguration
                    {
                        Assign = CascadeType.NoCascade,
                        Delete = CascadeType.RemoveLink,
                        Merge = CascadeType.NoCascade,
                        Reparent = CascadeType.NoCascade,
                        Share = CascadeType.NoCascade,
                        Unshare = CascadeType.NoCascade
                    }
                }
            };
        }

        private static StringAttributeMetadata Text(string suffix, string label)
            => Configure(new StringAttributeMetadata { MaxLength = 200, FormatName = StringFormatName.Text }, suffix, label);

        private static DateTimeAttributeMetadata Date(string suffix, string label, bool required = false)
            => Configure(new DateTimeAttributeMetadata { Format = DateTimeFormat.DateOnly, DateTimeBehavior = DateTimeBehavior.DateOnly }, suffix, label, required);

        private static BooleanAttributeMetadata Boolean(string suffix, string label)
            => Configure(new BooleanAttributeMetadata
            {
                DefaultValue = false,
                OptionSet = new BooleanOptionSetMetadata(new OptionMetadata(Label("Yes"), 1), new OptionMetadata(Label("No"), 0))
            }, suffix, label);

        private static T Configure<T>(T metadata, string suffix, string label, bool required = false) where T : AttributeMetadata
        {
            metadata.SchemaName = "gsic_" + suffix;
            metadata.LogicalName = metadata.SchemaName.ToLowerInvariant();
            metadata.DisplayName = Label(label);
            metadata.RequiredLevel = new AttributeRequiredLevelManagedProperty(required ? AttributeRequiredLevel.ApplicationRequired : AttributeRequiredLevel.None);
            return metadata;
        }

        private static Label Label(string text) => new Label(text, English);

        private static void Require(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }
    }
}

using System;
using Microsoft.PowerPlatform.Dataverse.Client;

namespace InterpreterCRM.SchemaSetup
{
    internal static class Program
    {
        private static int Main(string[] args)
        {
            if (args.Length == 1 && args[0] == "--help")
            {
                Console.WriteLine("Set DATAVERSE_CONNECTION_STRING and DATAVERSE_SOLUTION_UNIQUE_NAME, then run this tool without arguments. See DataverseSchema/README.md.");
                return 0;
            }

            var connection = Environment.GetEnvironmentVariable("DATAVERSE_CONNECTION_STRING");
            var solution = Environment.GetEnvironmentVariable("DATAVERSE_SOLUTION_UNIQUE_NAME");
            if (args.Length != 0 || string.IsNullOrWhiteSpace(connection) || string.IsNullOrWhiteSpace(solution))
            {
                Console.Error.WriteLine("Failed: configuration. Set DATAVERSE_CONNECTION_STRING and DATAVERSE_SOLUTION_UNIQUE_NAME; no command-line credentials are accepted.");
                return 1;
            }

            try
            {
                using (var client = new ServiceClient(connection))
                {
                    if (!client.IsReady)
                    {
                        Console.Error.WriteLine("Failed: Dataverse connection. Verify authentication and environment configuration.");
                        return 1;
                    }

                    new CreateComplaintSchema(client, Console.WriteLine).Run(solution);
                    return 0;
                }
            }
            catch (Exception exception)
            {
                // Authentication exceptions may contain connection details. Do not print them.
                Console.Error.WriteLine("Failed: setup (" + exception.GetType().Name + "). See the component log above. Completed changes remain; rerun after resolving the failure.");
                return 1;
            }
        }
    }
}

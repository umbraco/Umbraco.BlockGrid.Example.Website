using System;
using Umbraco.Cms.Core.Packaging;
using Umbraco.Extensions;

namespace UmbracoBlockGrid.Migrations
{
    public class UmbracoBlockGridMigrationPlan : PackageMigrationPlan
    {
        public UmbracoBlockGridMigrationPlan() : base("Umbraco Block Grid Example Website")
        {
        }

        protected override void DefinePlan()
        {
            // calculate the final state based on the hash value of the embedded resource
            Type planType = GetType();
            var hash = PackageMigrationResource.GetEmbeddedPackageDataManifestHash(planType);

            var finalId = hash.ToGuid();
            To<ImportPackageXmlMigration>(finalId);
                        
        }
    }
}

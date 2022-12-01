using System.IO;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Services;
using uSync.BackOffice;

namespace UmbracoBlockGrid.Site
{
    public class AutoExportPackageZip : IComposer
    {
        public void Compose(IUmbracoBuilder builder)
        {
            builder.AddNotificationHandler<uSyncExportedItemNotification, ExportPackgeZip>();
        }
    }

    public class ExportPackgeZip : INotificationHandler<uSyncExportedItemNotification>
    {
        private IPackagingService _packingService;

        public ExportPackgeZip(IPackagingService packagingService)
        {
            _packingService = packagingService;
        }

        public void Handle(uSyncExportedItemNotification notification)
        {
            // HACK THE PLANET !!

            // WHY?
            // If you make a change to doctypes or content that has been selected
            // as part of the created package in the backoffice
            // you HAVE to remember to export/download the ZIP manually
            // that contains the media and XML content etc

            // Then you need to copy that file over the top of the existing one
            // you are embedding in another class library/project (Which is the installable nuget package)

            // This will hopefully keep it in sync anytime uSync triggers a change
            // Such as content changed, doctypes etc

            // EEK still old ugly integer ids
            var packageDef = _packingService.GetCreatedPackageById(1);

            if(packageDef != null)
            {
                // Returns a FULL path such as...
                // C:\\Code\\UmbracoBlockGrid\\UmbracoBlockGrid.Site\\umbraco\\Data\\CreatedPackages\\Umbraco_Block_Grid_Example_Website\\package.zip
                var packageZipExported = _packingService.ExportCreatedPackage(packageDef);

                var embeddedZipFile = Path.Combine("../UmbracoBlockGrid/Migrations", "package.zip");
                var embeddedZipFileAbsolutePath = Path.GetFullPath(embeddedZipFile);

                // Copy file over the top of the one we are embdedding for the AutoPackageMigrationPlan
                // In the UmbracoBlockGrid project (This is the one that is the Nuget package)
                File.Copy(packageZipExported, embeddedZipFileAbsolutePath, true);
            }
        }
    }
}

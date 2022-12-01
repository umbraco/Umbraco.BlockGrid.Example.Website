using Microsoft.Extensions.Logging;
using System.Linq;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Infrastructure.Migrations;

namespace UmbracoBlockGrid.Migrations
{
    public class PublishRootBranchPostMigration : MigrationBase
    {
        private readonly ILogger<PublishRootBranchPostMigration> _logger;
        private readonly IContentService _contentService;

        public PublishRootBranchPostMigration(
            ILogger<PublishRootBranchPostMigration> logger,
            IContentService contentService,
            IMigrationContext context) : base(context)
        {
            _logger = logger;
            _contentService = contentService;
        }

        protected override void Migrate()
        {
            var contentHome = _contentService.GetRootContent().FirstOrDefault(x => x.ContentType.Alias == "blockGrid");
            if (contentHome != null)
            {
                _contentService.SaveAndPublishBranch(contentHome, true);
            }
            else
            {
                _logger.LogWarning("Unable to find the block grid example node to publish");
            }
        }
    }
}

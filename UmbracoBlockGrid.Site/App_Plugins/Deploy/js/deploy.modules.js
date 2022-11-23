angular.module('umbraco.deploy',
[
    'umbraco.filters',
    'umbraco.directives',
    'umbraco.services',
    'umbraco.deploy.filters',
    'umbraco.deploy.directives',
    'umbraco.deploy.resources',
    'umbraco.deploy.services',
    'umbraco.deploy.decorators',
    'umbraco.deploy.components'
]);
angular.module('umbraco.deploy.filters', []);
angular.module('umbraco.deploy.directives', []);
angular.module('umbraco.deploy.components', []);
angular.module('umbraco.deploy.resources', []);
angular.module('umbraco.deploy.services', []);
angular.module('umbraco.deploy.decorators', []);
angular.module('umbraco.packages').requires.push('umbraco.deploy');
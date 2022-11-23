var contentEditingHelperDecorator = function ($delegate, $routeParams, contentResource, deployHelper, editorState, localizationService, navigationService) {

    $delegate.configureContentEditorButtons = (function () {
        var cached_function = $delegate.configureContentEditorButtons;

        return function () {
            var buttons = cached_function.apply(this, arguments);
            if (Umbraco.Sys.ServerVariables.deploy &&
                Umbraco.Sys.ServerVariables.deploy.AllowDeployOptions &&
                Umbraco.Sys.ServerVariables.deploy.AllowDeployOptions === true) {

                if ($routeParams.section === "content" && $routeParams.create !== "true") {

                    // Only add the "compare" and "transfer now" buttons if the user has permissions to "queue for transfer".
                    contentResource.getById($routeParams.id).then(function (content) {
                        if (_.contains(content.allowedActions, "T")) {
                            deployHelper.addCompareButtonToButtonSet(buttons.subButtons, editorState.current, localizationService, navigationService);
                            deployHelper.addInstantDeployButtonToButtonSet(buttons.subButtons, editorState.current, localizationService, navigationService);                            
                        }
                    });
                }
            }
            return buttons;
        };
    } ());
    return $delegate;
};

angular.module("umbraco").config(["$provide", function ($provide) {
    $provide.decorator("contentEditingHelper", contentEditingHelperDecorator);
}]);

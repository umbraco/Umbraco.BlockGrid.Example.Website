(function () {
    'use strict';

    angular
        .module('umbraco.deploy.resources')
        .factory('deployResource', deployResource);

    deployResource.$inject = ['$http', '$q'];

    function deployResource($http, $q) {

        var baseUrl = Umbraco.Sys.ServerVariables.umbracoUrls.deployUiBaseUrl || Umbraco.Sys.ServerVariables.umbracoUrls.deployNoNodesBaseUrl;
        if (!baseUrl) {
            throw "No URL found for Deploy UI API";
        }

        var resource = {
            deploy: deploy,
            instantDeploy: instantDeploy,
            restore: restore,
            treeRestore: treeRestore,
            partialRestore: partialRestore,
            getStatus: getStatus,
            getEntityTypeForTreeMenu: getEntityTypeForTreeMenu,
            getUdiRange: getUdiRange,
            getCurrentUserFeedbackLevel: getCurrentUserFeedbackLevel,
            checkForRegisteredEntityWithPermissionToTransfer: checkForRegisteredEntityWithPermissionToTransfer,
            getRegisteredEntityRemoteTreeDetail: getRegisteredEntityRemoteTreeDetail,
            getEntityTypeToNameMap: getEntityTypeToNameMap,
            getContentComparison: getContentComparison
        };

        return resource;

        function deploy(targetUrl, enableWorkItemLogging, isLocal, isDeveloper, deploySchemaFiles) {

            var data = {
                TargetUrl: targetUrl,
                EnableLogging: enableWorkItemLogging,
                IsLocal: isLocal,
                IsDeveloper: isDeveloper,
                DeploySchemaFiles: deploySchemaFiles
            };

            return $http.post(baseUrl + "Deploy", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function instantDeploy(items, targetUrl, enableWorkItemLogging) {

            var data = {
                Items: items,
                TargetUrl: targetUrl,
                EnableLogging: enableWorkItemLogging
            };

            return $http.post(baseUrl + "InstantDeploy", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function restore(targetUrl, enableWorkItemLogging) {

            var data = {
                SourceUrl: targetUrl,
                EnableLogging: enableWorkItemLogging
            };

            return $http.post(baseUrl + "Restore", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function treeRestore(targetUrl, treeAlias, enableWorkItemLogging) {

            var data = {
                SourceUrl: targetUrl,
                TreeAlias: treeAlias,
                EnableLogging: enableWorkItemLogging
            };

            return $http.post(baseUrl + "TreeRestore", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function partialRestore(targetUrl, restoreNodes, enableWorkItemLogging) {

            var data = {
                SourceUrl: targetUrl,
                RestoreNodes: restoreNodes,
                EnableLogging: enableWorkItemLogging
            };

            return $http.post(baseUrl + "PartialRestore", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getStatus(sessionId) {

            var data = {
                SessionId: sessionId
            };

            return $http.post(baseUrl + "GetStatus", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getEntityTypeForTreeMenu(treeAlias, routePath) {

            var data = {
                treeAlias: treeAlias,
                routePath: routePath
            };

            return $http.post(baseUrl + "GetEntityTypeForTreeMenu", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function checkForRegisteredEntityWithPermissionToTransfer(treeAlias, routePath) {

            var data = {
                treeAlias: treeAlias,
                routePath: routePath
            };

            return $http.post(baseUrl + "IsRegisteredEntityWithPermissionToTransfer", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getRegisteredEntityRemoteTreeDetail(treeAlias, routePath) {

            var data = {
                treeAlias: treeAlias,
                routePath: routePath
            };

            return $http.post(baseUrl + "GetRegisteredEntityRemoteTreeDetail", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getEntityTypeToNameMap() {

            return $http.post(baseUrl + "GetEntityTypeToNameMap")
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getUdiRange(id, culture, includeDescendants, releaseDate, entityType) {

            var data = {
                id: id,
                culture: culture,
                includeDescendants: includeDescendants,
                releaseDate: releaseDate,
                entityType: entityType
            };

            return $http.post(baseUrl + "GetUdiRange", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getCurrentUserFeedbackLevel() {
            return $http.get(baseUrl + "GetCurrentUserFeedbackLevel")
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getContentComparison(udi, culture, workspaceUrl) {

            var data = {
                udi: udi,
                culture: culture,
                workspaceUrl: workspaceUrl
            };

            return $http.post(baseUrl + "GetContentComparison", data)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }
    }
})();

(function () {
    'use strict';

    angular
        .module('umbraco.deploy.resources')
        .factory('deployManagementResource', deployManagementResource);

    deployManagementResource.$inject = ['$http', '$q', 'umbRequestHelper', 'notificationsService'];

    function deployManagementResource($http, $q, umbRequestHelper, notificationsService) {

        var baseUrlName = 'deployManagementUiBaseUrl';

        var resource = {
            getDashboard: getDashboard,
            triggerOperation: triggerOperation,
            downloadDeployArtifacts: downloadDeployArtifacts,
            getFailedOperationDetail: getFailedOperationDetail,
            getConfigurationDetails: getConfigurationDetails,
            getSchemaComparison: getSchemaComparison,
            getSchemaComparisonForEntity: getSchemaComparisonForEntity,
        };

        return resource;

        function getDashboard() {

            return $http.get(umbRequestHelper.getApiUrl(baseUrlName, "GetDashboard"))
                .then(function (response) {
                        return response.data;
                    },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function triggerOperation(operation) {

            var data = {
                operation: operation,
            };

            return $http.post(umbRequestHelper.getApiUrl(baseUrlName, "TriggerOperation"), data)
                .then(function (response) {
                        return response.data;
                    },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getFailedOperationDetail() {

            return $http.get(umbRequestHelper.getApiUrl(baseUrlName, "GetFailedOperationDetail"))
                .then(function (response) {
                        return response.data;
                    },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function downloadDeployArtifacts() {
            var url = umbRequestHelper.getApiUrl(baseUrlName, "DownloadDeployArtifacts");
            return umbRequestHelper.downloadFile(url).then(function () {
                notificationsService.success("Deploy artifacts archive downloaded.");
            }, function (data) {
                notificationsService.success("An error occured downloading the Deploy artifacts: " + data.errorMsg);
            });
        }

        function getConfigurationDetails() {

            return $http.get(umbRequestHelper.getApiUrl(baseUrlName, "GetConfigurationDetails"))
                .then(function (response) {
                        return response.data;
                    },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getSchemaComparison() {

            return $http.get(umbRequestHelper.getApiUrl(baseUrlName, "GetSchemaComparison"))
                .then(function (response) {
                        return response.data;
                    },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getSchemaComparisonForEntity(udi) {

            return $http.get(umbRequestHelper.getApiUrl(baseUrlName, "GetSchemaComparisonForEntity?udi=" + udi))
                .then(function (response) {
                        return response.data;
                    },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }
    }
})();

(function () {
    'use strict';

    angular
        .module('umbraco.deploy.resources')
        .factory('queueResource', queueResource);

    queueResource.$inject = ['$http', '$q', 'umbRequestHelper'];

    function queueResource($http, $q, umbRequestHelper) {

        var baseUrlName = 'deployUiBaseUrl';

        var resource = {
            clearQueue: clearQueue,
            addToQueue: addToQueue,
            removeFromQueue: removeFromQueue,
            getQueue: getQueue,
            getLicenseStatus: getLicenseStatus
        };

        return resource;

        ////////////

        function clearQueue() {


            return $http.post(umbRequestHelper.getApiUrl(baseUrlName, "ClearQueue"))
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function addToQueue(item) {

            return $http.post(umbRequestHelper.getApiUrl(baseUrlName, "AddToQueue"), item)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function removeFromQueue(item) {

            return $http.post(umbRequestHelper.getApiUrl(baseUrlName, "RemoveFromQueue"), item)
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getQueue() {

            return $http.get(umbRequestHelper.getApiUrl(baseUrlName, "GetQueue"))
                .then(function (response) {
                    return response.data;
                },
                    function (response) {
                        return $q.reject(response.data);
                    });
        }

        function getLicenseStatus() {

            return $http.get(umbRequestHelper.getApiUrl(baseUrlName, "GetLicenseStatus"))
                .then(function (response) {
                    return true;
                },
                    function (response) {
                        console.log("Umbraco Deploy license check failed: " + response.data);
                        return false;
                    });
        }
    }
})();

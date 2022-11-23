angular.module('umbraco.deploy.services')
    .service('deployConfiguration',
    [
        '$http',
        function() {
            var instance = this;

            if (Umbraco.Sys.ServerVariables.deploy !== undefined && Umbraco.Sys.ServerVariables.deploy !== null) {
                angular.extend(instance, Umbraco.Sys.ServerVariables.deploy);
            } else {
                console.log('Could not get deploy configuration');
            }

            return instance;
        }
    ]);
angular.module('umbraco.deploy.services')
    .service('deployService',
        [
            '$http', '$q', 'deployConfiguration', '$rootScope', 'deployNavigation', 'deployResource',
            function ($http, $q, deployConfiguration, $rootScope, deployNavigation, deployResource) {

                var instance = this;

                instance.sessionId = '';
                instance.pSessionId = '';

                instance.error = undefined;

                instance.deploy = function (enableWorkItemLogging, schemaInfo) {

                    return deployResource.deploy(deployConfiguration.Target.DeployUrl, enableWorkItemLogging,
                        schemaInfo.isLocal,
                        schemaInfo.isDeveloper,
                        schemaInfo.doAutomaticSchemaTransfer)
                        .then(function (data) {
                            instance.setSessionId(data.SessionId);
                            return data;
                        }, function (data) {
                            return $q.reject(data);
                        });
                };

                instance.instantDeploy = function (item, enableWorkItemLogging) {

                    // get the item with Udi from the server
                    return deployResource.getUdiRange(item.id, item.culture, item.includeDescendants, item.releaseDate, item.entityType).then(function (data) {

                        if (data !== 'null' && data !== null) {
                            // deploy item
                            var items = [];
                            items.push(data);

                            return deployResource.instantDeploy(items, deployConfiguration.Target.DeployUrl, enableWorkItemLogging)
                                .then(function (data) {
                                    instance.setSessionId(data.SessionId);
                                    return data;
                                },
                                    function (data) {
                                        return $q.reject(data);
                                    });
                        }
                    }, function (error) {
                        return $q.reject(error);
                    });
                };

                instance.restore = function (targetUrl, treeAlias, enableWorkItemLogging) {

                    if (treeAlias) {
                        return deployResource.treeRestore(targetUrl, treeAlias, enableWorkItemLogging)
                            .then(function (data) {
                                instance.setSessionId(data.SessionId);
                                return data;
                            }, function (data) {
                                return $q.reject(data);
                            });
                    } else {
                        return deployResource.restore(targetUrl, enableWorkItemLogging)
                            .then(function (data) {
                                instance.setSessionId(data.SessionId);
                                return data;
                            }, function (data) {
                                return $q.reject(data);
                            });
                    }

                };

                instance.partialRestore = function (targetUrl, restoreNodes, enableWorkItemLogging) {

                    return deployResource.partialRestore(targetUrl, restoreNodes, enableWorkItemLogging)
                        .then(function (data) {
                            instance.setSessionId(data.SessionId);
                            return data;
                        }, function (data) {
                            return $q.reject(data);
                        });
                };

                instance.feedbackMessageLevel = function () {
                    return deployResource.getCurrentUserFeedbackLevel();
                };

                instance.getStatus = function () {

                    return deployResource.getStatus(instance.sessionId)
                        .then(function (data) {
                            $rootScope.$broadcast('deploy:sessionUpdated',
                                {
                                    sessionId: data.SessionId,
                                    status: data.Status,
                                    comment: data.Comment,
                                    percent: data.Percent,
                                    log: data.Log,
                                    exception: data.Exception,
                                    mismatchList: data.mismatchList
                                });
                            return data;
                        }, function (data) {
                            // todo - need different response messages so a session that doesnt exist doesn't cause an error coded response.
                            instance.removeSessionId();
                            return $q.reject(data);
                        });

                };

                instance.setSessionId = function (sessionId) {
                    instance.sessionId = sessionId;
                    localStorage.setItem('deploySessionId', sessionId);
                };

                instance.removeSessionId = function () {
                    instance.pSessionId = instance.sessionId;
                    instance.sessionId = null;
                    localStorage.removeItem('deploySessionId');
                };

                instance.getSessionId = function () {
                    var deploySessionId = localStorage.getItem('deploySessionId');
                    return deploySessionId;
                };

                instance.isOurSession = function (sessionId) {
                    if (instance.sessionId === sessionId) return true;
                    if (instance.pSessionId !== sessionId) return false;
                    instance.pSessionId = null;
                    return true;
                }

                instance.prettyEntityType = function (udi) {
                    var p1 = udi.indexOf('//');
                    var p2 = udi.indexOf('/', p1 + 2);
                    var n = udi.substr(p1 + 2, p2 - p1 - 2);
                    n = n.replace('-', ' ');
                    n = n.substr(0, 1).toUpperCase() + n.substr(1);
                    return n;
                }

                instance.getViewName = function (name) {
                    if (name.includes('.cshtml')) {
                        return name.replace('umb://template-file/', '');
                    }

                    return name;
                }

                instance.isDeveloper = function (userFeedbackLevel) {
                    if (userFeedbackLevel === 'Developer') {
                        return true;
                    }

                    return false;
                }

                // TODO: This doesn't seem to do anything
                instance.getSessionId();

                return instance;
            }
        ]);

(function () {
    'use strict';

    angular
        .module('umbraco.deploy.services')
        .factory('deployHelper', deployHelperService);

    function deployHelperService() {

        var service = {
            getDeployItem: getDeployItem,
            getStatusValue: getStatusValue,
            getEntityTypeFromUdi: getEntityTypeFromUdi,
            addInstantDeployButtonToButtonSet: addInstantDeployButtonToButtonSet,
            addCompareButtonToButtonSet: addCompareButtonToButtonSet,
            getEntityName: getEntityName
        };

        return service;

        ////////////

        function getDeployItem(node, culture, includeDescendants, releaseDate, $routeParams, treeService, deployResource) {

            var item = {
                id: node.id,
                name: node.name,
                culture: culture,
                includeDescendants: includeDescendants,
                releaseDate: releaseDate
            };

            // Align back-office references to entities with those used by Deploy.
            // If triggered from a tree, we'll have the tree details available on the node.
            // If not, we can get from the route params.
            var treeAlias = treeService.getTreeAlias(node) || $routeParams.tree;
            var routePath = node.routePath || $routeParams.section + "/" + $routeParams.tree + "/" + $routeParams.method + "/" + $routeParams.id;
            return deployResource.getEntityTypeForTreeMenu(treeAlias, routePath)
                .then(function (data) {
                    item.entityType = data.EntityType;

                    // for some reason some of the tree roots doesn't return -1 ... ensure they do now
                    if (node.nodeType === 'initstylesheets' ||
                        node.nodeType === 'initscripts' ||
                        node.nodeType === 'initdictionary' ||
                        node.nodeType === 'initmacros' ||
                        node.nodeType === 'initmemberGroup' ||
                        node.nodeType === 'initxslt') {
                        item.id = '-1';
                    }

                    // make sure that a root node always include all children
                    if (item.id === '-1') {
                        item.includeDescendants = true;
                    }

                    // fix missing stylesheet extension
                    if (item.entityType === 'stylesheet' && item.id !== '-1' && item.id.indexOf('.css') === -1) {
                        item.id = item.id + '.css';
                    }

                    return item;
                });
        };

        function getStatusValue(number) {
            switch (number) {
                case 2:
                    return 'inProgress';
                case 3:
                    return 'completed';
                case 4:
                    return 'failed';
                case 5:
                    return 'cancelled';
                case 6:
                    return 'timedOut';
                case 7:
                    return 'mismatch';
                default:
                    return '';
            };
        };

        function getEntityTypeFromUdi(udi) {
            var m = udi.match(/umb:\/\/(.+)\//);
            if (m !== null) {
                return m[1];
            }
            return null;
        };

        function addInstantDeployButtonToButtonSet(buttons, node, localizationService, navigationService) {
            addButtonToButtonSet(buttons, node, localizationService, navigationService,
                "D", "deployTransferNow", "ctrl+d", "deploy.html");
        };

        function addCompareButtonToButtonSet(buttons, node, localizationService, navigationService) {
            addButtonToButtonSet(buttons, node, localizationService, navigationService,
                "C", "deployCompare", "ctrl+c", "compare.html");
        };

        function addButtonToButtonSet(buttons, node, localizationService, navigationService, letter, labelKey, hotKey, dialogView) {
            buttons.push({
                letter: letter,
                labelKey: "actions_" + labelKey,
                hotKey: hotKey,
                hotKeyWhenHidden: true,
                handler: function () {

                    //getting the current tree node to open the dialog against.
                    if (!node.nodeType && node.udi) {
                        node.nodeType = getEntityTypeFromUdi(node.udi);
                    }

                    localizationService.localize("dialogs_" + labelKey + "Title").then(function (value) {
                        navigationService.showDialog({
                            action: {
                                name: value,
                                metaData: {
                                    actionView: "../App_Plugins/Deploy/views/dialogs/" + dialogView,
                                    dialogMode: true
                                }
                            },
                            node: node
                        });
                    });
                }
            });
        };

        function getEntityName(entityType, entityTypeToNameMap) {
            return entityTypeToNameMap[entityType] || "Other items";
        };
    }

})();

angular.module('umbraco.deploy.services')
    .service('deployNavigation',
    [
        '$timeout',
        function ($timeout) {

            var instance = this;

            instance.view = 'queue';

            instance.navigate = function(viewname) {
                // using $timeout to defer this from the current digest cycle
                $timeout(function() {
                    instance.view = viewname;
                });
            };

            return instance;
        }
    ]);
(function () {
    'use strict';

    angular
        .module('umbraco.deploy.services')
        .factory('pluginEntityService', pluginEntityService);

    function pluginEntityService($routeParams, deployResource, deployHelper, editorState, localizationService, navigationService) {

        var service = {
            addInstantDeployButton: addInstantDeployButton
        };

        return service;

        ////////////        

        function addInstantDeployButton(buttons) {
            var treeAlias = $routeParams.tree;
            var routePath = $routeParams.section + "/" + $routeParams.tree + "/" + $routeParams.method + "/" + $routeParams.id;
            deployResource.checkForRegisteredEntityWithPermissionToTransfer(treeAlias, routePath)
                .then(function (data) {
                    if (data.CanTransfer) {
                        deployHelper.addInstantDeployButtonToButtonSet(buttons, editorState.current, localizationService, navigationService);
                    }
                });
        }
    }

})();

angular.module('umbraco.deploy.services')
    .service('deployQueueService',
        [
            '$q', 'notificationsService', 'queueResource',
            function ($q, notificationsService, queueResource) {

                var instance = this;

                instance.queue = [];

                instance.clearQueue = function () {

                    return queueResource.clearQueue()
                        .then(function (data) {
                            instance.queue.splice(0);
                            return instance.queue;
                        }, function (data) {
                            notificationsService.error('Error', 'Could not clear the queue.');
                            return $q.reject(data);
                        });
                };

                instance.addToQueue = function (item) {

                    return queueResource.addToQueue(item)
                        .then(function (data) {

                            if (data !== 'null' && data !== null) {
                                _.forEach(data,
                                    function (rItem) {
                                        var found = _.find(instance.queue,
                                            function (o) {
                                                return o.Udi === rItem.Udi;
                                            });
                                        if (found !== undefined && found !== null) {
                                            found.IncludeDescendants = rItem.IncludeDescendants;
                                        } else {
                                            instance.queue.push(rItem);
                                        }
                                    });
                            }
                            return instance.queue;

                        }, function (data) {
                            notificationsService.error('Error', data.ExceptionMessage);
                            return $q.reject(data);
                        });

                };

                instance.removeFromQueue = function (item) {

                    return queueResource.removeFromQueue(item)
                        .then(function (data) {
                            instance.queue.splice(instance.queue.indexOf(item), 1);
                            return instance.queue;
                        }, function (data) {
                            notificationsService.error('Error', data.ExceptionMessage);
                            return $q.reject(data);
                        });
                }

                instance.refreshQueue = function () {

                    return queueResource.getQueue()
                        .then(function (data) {
                            instance.queue.splice(0);
                            _.forEach(data, function (item) {
                                instance.queue.push(item);
                            });
                            return instance.queue;
                        }, function (data) {
                            notificationsService.error('Error', 'Could not retrieve the queue.');
                            return $q.reject(data);
                        });
                };

                instance.isLicensed = function () {

                    return queueResource.getLicenseStatus()
                        .then(function (data) {
                            return data;
                        }, function (data) {
                            return false;
                        });
                };

                instance.refreshQueue();

                return instance;
            }
        ]);

angular.module('umbraco.deploy.services')
    .service('deploySignalrService',
    [
        '$rootScope',
        function ($rootScope) {

            var instance = this;

            var initialized = false;
            var lock = false;

            instance.initialize = function () {
                if (initialized === false && lock === false) {
                    lock = true;
                    
                    // If connection already exists and is connected just return, otherwise we might have multiple connections.
                    if ($.deployConnection && $.deployConnection.connectionState === signalR.HubConnectionState.Connected &&
                        $.restoreConnection && $.restoreConnection.connectionState === signalR.HubConnectionState.Connected) {
                        return;
                    }
                    
                    // Create connections
                    var deployConnectionBuilder = new signalR.HubConnectionBuilder()
                        .withUrl(Umbraco.Sys.ServerVariables.umbracoUrls["deployHubUrl"])
                        .withAutomaticReconnect();

                    var restoreConnectionBuilder = new signalR.HubConnectionBuilder()
                        .withUrl(Umbraco.Sys.ServerVariables.umbracoUrls["restoreHubUrl"])
                        .withAutomaticReconnect();

                    if (Umbraco.Sys.ServerVariables.isDebuggingEnabled) {
                        deployConnectionBuilder.configureLogging(signalR.LogLevel.Debug);
                        restoreConnectionBuilder.configureLogging(signalR.LogLevel.Debug);
                    } else {
                        deployConnectionBuilder.configureLogging(signalR.LogLevel.None);
                        restoreConnectionBuilder.configureLogging(signalR.LogLevel.None);
                    }
                    
                    $.deployConnection = deployConnectionBuilder.build();
                    $.restoreConnection = restoreConnectionBuilder.build();
                    
                    // Register handlers
                    // DeployHub
                    $.deployConnection.on("heartbeat", function (sessionId, serverTimestamp){
                        $rootScope.$broadcast('deploy:heartbeat', {
                            sessionId: sessionId, serverTimestamp: serverTimestamp
                        });
                    })
                    
                    $.deployConnection.on("sessionUpdated", function (sessionId, status, comment, percent, log, exceptionJson, serverTimestamp, mismatchList){
                        $rootScope.$broadcast('deploy:sessionUpdated', {
                            sessionId: sessionId, status: status, comment: comment, percent: percent, log: log, exception: angular.fromJson(exceptionJson), serverTimestamp: serverTimestamp, mismatchList: mismatchList
                        });
                    })
                    
                    // RestoreHub
                    $.restoreConnection.on("heartbeat", function (sessionId, serverTimestamp){
                        $rootScope.$broadcast('restore:heartbeat', {
                            sessionId: sessionId, serverTimestamp: serverTimestamp
                        });
                    })
                    
                    $.restoreConnection.on("sessionUpdated", function (sessionId, status, comment, percent, log, exceptionJson, serverTimestamp){
                        $rootScope.$broadcast('restore:sessionUpdated', {
                            sessionId: sessionId, status: status, comment: comment, percent: percent, log: log, exception: angular.fromJson(exceptionJson), serverTimestamp: serverTimestamp
                        });
                    })
                    
                    $.restoreConnection.on("diskReadSessionUpdated", function (sessionId, status, comment, percent, log, exceptionJson, serverTimestamp){
                        $rootScope.$broadcast('restore:diskReadSessionUpdated', {
                            sessionId: sessionId, status: status, comment: comment, percent: percent, log: log, exception: angular.fromJson(exceptionJson), serverTimestamp: serverTimestamp
                        });
                    })
                    
                    // Connect
                    try {
                        // The deploy hub can only be accessed via an authenticated back-office request, so to avoid console errors that will
                        // occur when calling from the "no nodes" page, we won't try to start the connection if we are't in the back-office proper.
                        var isBackOfficeRequest = function () {
                            // We need to do this check without having the full angularjs back-office app running, as we may be in the "no nodes"
                            // page.  The "no nodes" page has a minimal setup of the servervariables construct so we can use this to check.
                            return Umbraco.Sys.ServerVariables.application !== undefined;
                        };

                        if (isBackOfficeRequest()) {
                            $.deployConnection.start().then(function () { }).catch(function () {
                                console.error("Could not connect to DeployHub.");
                            });
                        }

                        // As well as in an authenticated back-office request, the restore hub can also be called from the "no nodes" page
                        // (for restoring content).  Hence we just try to connect to this one.
                        $.restoreConnection.start().then(function () { }).catch(function () {
                            console.error("Could not connect to RestoreHub.");
                        });
                        
                    } catch (e) {
                        console.error("Could not establish signalR connection. Error: " + e)
                    }

                    initialized = true;
                    lock = false;
                }
            };

            instance.initialize();

            return instance;
        }
    ]);

(function () {
    'use strict';

    angular
        .module('umbraco.deploy.services')
        .factory('workspaceHelper', workspaceHelperService);

    function workspaceHelperService($window) {

        var service = {
            getActiveWorkspace: getActiveWorkspace,
            addWorkspaceInPortal: addWorkspaceInPortal,
            addAddWorkspace: addAddWorkspace
        };

        return service;

        ////////////

        function getActiveWorkspace(workspaces) {
            for (var i = 0; i < workspaces.length; i++) {
                var workspace = workspaces[i];
                if (workspace.Active === true) {
                    return workspace;
                }
            }
        }

        function addWorkspaceInPortal(projectUrl) {
            $window.open(projectUrl + "?addEnvironment=true");
        }

        function addAddWorkspace(workspaces) {
            var devWorkspaceFound = false;
            
            var addWorkspace = {
                Name: 'Add workspace',
                Type: 'inactive',
                Current: false,
                Active: false
            };

            angular.forEach(workspaces, function (workspace) {
                if (workspace.Type === 'development') {
                    devWorkspaceFound = true;
                }
            });

            if (!devWorkspaceFound) {
                workspaces.unshift(addWorkspace);
            }
        }
    }
})();
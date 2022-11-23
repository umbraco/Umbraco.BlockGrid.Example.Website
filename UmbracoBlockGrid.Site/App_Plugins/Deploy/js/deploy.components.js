(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udConnectLocal', udConnectLocalComponent);

    function udConnectLocalComponent() {

        function link(scope, element, attr, ctrl) {

            scope.connectionOptions = [
                {
                    'name': 'Use Visual Studio',
                    'detailsAlias': 'vs',
                    'icon': 'icon-infinity'
                },
                {
                    'name': 'Use Grunt or Gulp',
                    'detailsAlias': 'cli',
                    'icon': 'icon-terminal'
                },
                {
                    'name': 'Connect with git',
                    'detailsAlias': 'git',
                    'icon': 'icon-forms-github'
                }
            ];
            
            scope.visibleConnectionDetail = '';


            scope.showConnectionDetails = function(type) {
                scope.visibleConnectionDetail = type;
            };

        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/udconnectlocal/udconnectlocal.html',
            scope: {
                'gitUrl': "@",
            },
            link: link
        };

        return directive;

    }

})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udContentFlow', udContentflowComponent);

    function udContentflowComponent(workspaceHelper, angularHelper, deployQueueService, deployService, deployConfiguration, deploySignalrService, deployHelper, notificationsService) {

        function link(scope, element, attr, ctrl) {

            scope.config = deployConfiguration;
            scope.enableWorkItemLogging = false;
            scope.feedbackMessageLevel = '';
            scope.solvedMismatches = [];
            scope.isFeedbackMessageLevelSet = false;

            var timestampFormat = 'MMMM Do YYYY, HH:mm:ss';
            var serverTimestampFormat = 'YYYY-MM-DD HH:mm:ss,SSS';

            // beware, MUST correspond to what's in WorkStatus
            var workStatus = ["Unknown", "New", "Executing", "Completed", "Failed", "Cancelled", "TimedOut"];

            function onInit() {

                // make local collection of workspaces because we will have to add "local" and "add workspace".
                scope.dashboardWorkspaces = angular.copy(scope.config.Workspaces);

                // reset the deploy progress
                scope.resetDeploy();

                // add "Add workspace"
                if (scope.showAddWorkspace) {
                    workspaceHelper.addAddWorkspace(scope.dashboardWorkspaces);
                }

                // set active workspace
                setCurrentWorkspace(scope.dashboardWorkspaces);

                deployService.feedbackMessageLevel().then(function(data) {
                    scope.feedbackMessageLevel = data.FeedbackMessageLevel;
                    scope.isFeedbackMessageLevelSet = true;
                });

            }

            function setCurrentWorkspace(workspaces) {
                angular.forEach(workspaces, function (workspace) {
                    if (workspace.Type === scope.config.CurrentWorkspaceType) {
                        workspace.Current = true;
                        workspace.Active = true;
                        scope.showWorkspaceInfo(workspace);
                    }
                });
            }

            // debug

            function updateLog(event, sessionUpdatedArgs) {

                // make sure the event is for us
                if (deployService.isOurSession(sessionUpdatedArgs.sessionId)) {
                    angularHelper.safeApply(scope, function () {
                        var progress = sessionUpdatedArgs;
                        scope.deploy.trace += "" + progress.sessionId.substr(0, 8) + " - " + workStatus[progress.status] + ", " + progress.percent + "%"
                            + (progress.comment ? " - <em>" + progress.comment + "</em>" : "") + "<br />";
                        if (progress.log)
                            scope.deploy.trace += "<br />" + filterLog(progress.log) + "<br /><br />";
                    });
                }
            }

            function filterLog(log) {
                log = log.replace(/(?:\&)/g, '&amp;');
                log = log.replace(/(?:\<)/g, '&lt;');
                log = log.replace(/(?:\>)/g, '&gt;');
                log = log.replace(/(?:\r\n|\r|\n)/g, '<br />');
                log = log.replace(/(?:\t)/g, '  ');
                log = log.replace('-- EXCEPTION ---------------------------------------------------', '<span class="umb-deploy-debug-exception">-- EXCEPTION ---------------------------------------------------');
                log = log.replace('----------------------------------------------------------------', '----------------------------------------------------------------</span>');
                return log;
            }

            // signalR events for deploy progress
            scope.$on('deploy:sessionUpdated', function (event, args) {

                // make sure the event is for us
                if (args.sessionId === deployService.sessionId) {
                    angularHelper.safeApply(scope, function () {
                        scope.deploy.deployProgress = args.percent;
                        scope.deploy.currentActivity = args.comment;
                        scope.deploy.status = deployHelper.getStatusValue(args.status);
                        scope.deploy.timestamp = moment().format(timestampFormat);
                        scope.deploy.serverTimestamp = moment(args.serverTimestamp).format(serverTimestampFormat);

                        if (scope.deploy.status === 'completed') {
                            deployQueueService.clearQueue();
                            deployService.removeSessionId();
                        } else if (scope.deploy.status === 'mismatch') {
                            scope.solvedMismatches = args.mismatchList;
                        } else if (scope.deploy.status === 'failed' || scope.deploy.status === 'cancelled' || scope.deploy.status === 'timedOut') {

                            scope.deploy.error = {
                                hasError: true,
                                comment: args.comment,
                                log: args.log,
                                exception: args.exception
                            };
                        }
                    });
                }
            });

            // signalR heartbeat
            scope.$on('deploy:heartbeat', function (event, args) {
                if (!deployService.isOurSession(args.sessionId)) return;

                angularHelper.safeApply(scope, function () {
                    if (scope.deploy) {
                        scope.deploy.timestamp = moment().format(timestampFormat);
                        scope.deploy.serverTimestamp = moment(args.serverTimestamp).format(serverTimestampFormat);
                    }
                });
            });

            // signalR debug heartbeat
            scope.$on('deploy:heartbeat', function (event, args) {
                if (!deployService.isOurSession(args.sessionId)) return;
                angularHelper.safeApply(scope, function () {
                    scope.deploy.trace += "❤<br />";
                });
            });

            // debug
            // note: due to deploy.service also broadcasting at beginning, the first line could be duplicated
            scope.$on('deploy:sessionUpdated', updateLog);
            scope.$on('restore:sessionUpdated', updateLog);

            scope.resetDeploy = function () {
                //Refetch the queue - after a sucess or failed deploy
                //Sometimes we may not have anything in the queue - so need to ensure we re-fetch it
                deployQueueService.refreshQueue();

                scope.deploy = {
                    'deployProgress': 0,
                    'currentActivity': '',
                    'status': '',
                    'error': {},
                    'trace': '',
                    'showDebug': false
                };
            };

            scope.selectWorkspace = function(selectedWorkspace, workspaces) {
                
                // deselect all workspaces
                if(workspaces) {
                    angular.forEach(workspaces, function(workspace){
                        workspace.Active = false;
                    });
                }

                // deselect local workspace
                if(scope.localWorkspace) {
                    scope.localWorkspace.Active = false;
                }

                // select workspace
                if(selectedWorkspace) {
                    selectedWorkspace.Active = true;
                }

                scope.showWorkspaceInfo(selectedWorkspace);

            };

            scope.showWorkspaceInfo = function (workspace) {

                if (workspace.Type === 'inactive') {
                    scope.workspaceInfobox = 'addWorkspace';
                } else if (workspace.Type === 'local' && !workspace.Current) {
                    scope.workspaceInfobox = 'connect';
                }
                else if (workspace.Current && scope.config.Target) {
                    scope.workspaceInfobox = 'deploy';
                }
                else {
                    scope.workspaceInfobox = 'info';
                }

            };

            scope.getActiveWorkspace = function() {
                return workspaceHelper.getActiveWorkspace(scope.dashboardWorkspaces);
            };

            scope.addWorkspaceInPortal = function (projectUrl) {
                workspaceHelper.addWorkspaceInPortal(projectUrl);
            };

            // call back when deploy is successfully started
            scope.onDeployStartSuccess = function(data) {
                scope.deploy.deployProgress = 0;
                scope.deploy.currentActivity = "Please wait...";
                scope.deploy.status = deployHelper.getStatusValue(2);
                scope.deploy.timestamp = moment().format(timestampFormat);
                if (scope.enableWorkItemLogging) {
                    scope.deploy.showDebug = true;
                }
            };

            scope.showDebug = function() {
                scope.deploy.showDebug = !scope.deploy.showDebug;
            };

            scope.copyDebugToClipboard = function () {
                var trace = scope.deploy.trace;
                trace = trace.replace(/<br\s*\/?>/mg, "\n");
                trace = trace.replace(/<\/?[^>]+(>|$)/g, "");
                navigator.clipboard.writeText(trace);
                notificationsService.success("Technical details copied to clipboard.");
            };

            var search = window.location.search;
            scope.enableWorkItemLogging = search === '?ddebug';

            onInit();
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/udcontentflow/udcontentflow.html',
            link: link,
            scope: {
                allowManageWorkspaces: "="
            }
        };

        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udError', udErrorComponent);

    function udErrorComponent() {
        function link(scope) {

            scope.errorDetailsVisible = false;
            scope.toggleErrorDetails = function() {
                scope.errorDetailsVisible = !scope.errorDetailsVisible;
            }

            // fetch the inner exception that actually makes sense to show in the UI.
            // AggregateException and RemoteApiException are completely non-saying about what the problem is
            // so we should try to get the inner exception instead and use that for displaying errors.

            var e = scope.exception;

            while (e != null) {
                if (e.HasMeaningForUi != null) {
                    scope.innerException = e;
                    break;
                }
                if (e.Type != null && e.Type === 'Umbraco.Deploy.Infrastructure.Exceptions.RemoteApiException') {
                    e = e.Error;
                    continue;
                }
                else if (e.InnerException != null) {
                    e = e.InnerException;
                    continue;
                }
                scope.innerException = e;
                break;
            }

            e = scope.exception;

            var udis = [];
            while (e != null) {
                if (e.ExceptionType != null && e.ExceptionType === 'Umbraco.Deploy.Infrastructure.Exceptions.RemoteApiException') {
                    e = e.Error;
                } else {
                    if (e.Udi && udis.indexOf(e.Udi) < 0) {
                        udis.push(e.Udi);
                    }

                    e = e.InnerException;
                }
            }

            scope.exceptionUdis = udis;
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/uderror/uderror.html',
            scope: {
                'exception': "=",
                'comment': "=",
                'log': "=",
                'status': "=",
                'onBack': "&",
                'onDebug': "&",
                'noNodes': '=',
                'operation': '@operation',
                'timestamp': "=",
                'serverTimestamp': "=",
                'showDebug': "=",
                'feedbackMessageLevel': "="
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udInfobox', udInfoboxComponent);

    function udInfoboxComponent() {

        function link() {
            
        }

        var directive = {
            restrict: 'E',
            transclude: true,
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/udinfobox/udinfobox.html',
            link: link
        };

        return directive;

    }

})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udDeployComplete', udDeployCompleteComponent);

    function udDeployCompleteComponent(deployService) {
        function link(scope, element, attr, ctrl) {
            scope.isSchemaFiles = false;
            scope.schemaFiles = [];

            
            if (scope.solvedMismatches !== undefined && scope.solvedMismatches !== null) {
                scope.solvedMismatches.forEach(function(mismatch) 
                {
                    var schemaFile =
                    {
                        Type: deployService.prettyEntityType(mismatch.Udi),
                        Name: deployService.getViewName(mismatch.Name)
                    }
                    
                    scope.schemaFiles.push(schemaFile);
                });

                if (scope.schemaFiles.length > 0) {
                    scope.isSchemaFiles = true;
                }
            }
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/deploy/uddeploycomplete/uddeploycomplete.html',
            scope: {
                'targetName': "=",
                'targetUrl': "=",
                'timestamp': "=",
                'serverTimestamp': "=",
                'onBack': "&",
                'solvedMismatches': "="
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udDeployProgress', udDeployProgressComponent);

    function udDeployProgressComponent() {
        function link(scope, element, attr, ctrl) {
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/deploy/uddeployprogress/uddeployprogress.html',
            scope: {
                'targetName': "=",
                'progress': "=",
                'currentActivity': "=",
                'timestamp': "=",
                'serverTimestamp': "="
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udDeployQueue', udDeployQueueComponent);

    function udDeployQueueComponent($q, deployQueueService, deployService, deployResource, deployHelper, overlayService, languageResource, userService, dateHelper) {
        function link(scope, element, attr, ctrl) {
            var eventBindings = [];

            scope.loading = true;
            var entityTypeToNameMap = {};
            var languages = {};
            var currentUser = null;

            scope.deployButtonState = "init";
            
            scope.deployInfo = {
                doAutomaticSchemaTransfer: false,
                isLocal: scope.isLocal,
                isDeveloper: deployService.isDeveloper(scope.userFeedbackLevel)
            };

            function init() {
                $q.all([
                    deployResource.getEntityTypeToNameMap().then(function (data) {
                        entityTypeToNameMap = data.Map;
                    }),
                    languageResource.getAll().then(function (data) {
                        languages = _.indexBy(data, 'culture');
                    }),
                    userService.getCurrentUser().then(function (user) {
                        currentUser = user;
                    })
                ]).then(function () {
                    scope.items = deployQueueService.queue;
                    scope.loading = false;
                });
            }

            init();

            scope.startDeploy = function () {

                scope.deployButtonState = "busy";

                deployService.deploy(scope.enableWorkItemLogging, scope.deployInfo).then(function(data) {

                    if(scope.onDeployStartSuccess) {
                        scope.onDeployStartSuccess({'data': data});
                    }

                    //Set button state to success (We most likely not see this state as the above will trigger the error view change)
                    scope.deployButtonState = "success";

                }, function (error) {

                    //Catching the 500 error from the request made to the UI/API Controller to trigger an instant deployment
                    //Other errors will be caught in 'deploy:sessionUpdated' event pushed out

                    //We don't have ClassName in our Exception here but ExceptionType is what we have
                    //Push in the value manually into our error/exception object
                    error['ClassName'] = error.ExceptionType;

                    //Parent Scope (As this is nested inside ud-content-flow)
                    scope.$parent.deploy.status = 'failed';
                    scope.$parent.deploy.error = {
                        hasError: true,
                        comment: error.Message,
                        exception: error
                    };

                    //Set button state to error (We most likely not see this state as the above will trigger the error view change)
                    scope.deployButtonState = "error";

                });

            };

            scope.clearQueue = function () {

                var overlay = {
                    view: "confirm",
                    title: "Confirmation",
                    content: "Are you sure you want to remove all items from the transfer queue?",
                    closeButtonLabel: "No",
                    submitButtonLabel: "Yes",
                    submitButtonStyle: "danger",
                    close: function () {
                        overlayService.close();
                    },
                    submit: function () {
                        deployQueueService.clearQueue();
                        overlayService.close();
                    }
                };
                overlayService.open(overlay);
            };

            scope.removeFromQueue = function (item) {
                deployQueueService.removeFromQueue(item);
            };

            scope.refreshQueue = function () {
                deployQueueService.refreshQueue();
            };

            scope.toggleEntityTypeItems = function(items) {
                items.showItems = !items.showItems;
            };

            scope.getEntityName = function (entityType) {
                return deployHelper.getEntityName(entityType, entityTypeToNameMap);
            };

            function setItemDescription(items) {
                angular.forEach(items, function (item) {
                    var descriptions = [];

                    if (item.Culture && item.Culture.length > 0) {
                        if (item.Culture == "*") {
                            descriptions.push("All languages");
                        } else if (languages[item.Culture]) {
                            // Show language name
                            descriptions.push("Language: " + languages[item.Culture].name);
                        } else {
                            // Fallback to culture
                            descriptions.push("Language: " + item.Culture);
                        }
                    }

                    if (item.IncludeDescendants) {
                        descriptions.push("Including all items below");
                    }

                    if (item.ReleaseDate) {
                        descriptions.push("Publish at: " + formatDateTime(item.ReleaseDate));
                    }

                    item.Description = descriptions.join(" - ");
                });
            }

            function formatDateTime(date) {
                return dateHelper.getLocalDate(date, currentUser.locale, "MMM Do YYYY, HH:mm")
            }

            eventBindings.push(scope.$watch('items', function(newValue, oldValue){
                setItemDescription(scope.items);
            }, true));

            // clean up
            scope.$on('$destroy', function () {
                // unbind watchers
                for (var e in eventBindings) {
                    eventBindings[e]();
                }
            });

        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/deploy/uddeployqueue/uddeployqueue.html',
            scope: {
                targetName: "=",
                targetUrl: "=",
                isLocal: "=",
                userFeedbackLevel: "=",
                enableWorkItemLogging: "=",
                onDeployStartSuccess: "&"
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udBusyError', udBusyErrorComponent);

    function udBusyErrorComponent() {
        function link(scope, element, attr, ctrl) {
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udbusyerror/udbusyerror.html',
            scope: {
                'exception': "=",
                'feedbackMessageLevel': "=",
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udChunkDecodingError', udChunkDecodingErrorComponent);

    function udChunkDecodingErrorComponent() {
        function link(scope, element, attr, ctrl) {
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udchunkdecodingerror/udchunkdecodingerror.html',
            scope: {
                'feedbackMessageLevel': "=",
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udCollisionError', udCollisionErrorComponent);

    function udCollisionErrorComponent() {
        function link(scope, element, attr, ctrl) {
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udcollisionerror/udcollisionerror.html',
            scope: {
                'exception': "=",
                'exceptionUdis': "=",
                'operation': "=",
                'feedbackMessageLevel': "="
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udContentTypeChangedError', udContentTypeChangedErrorComponent);

    function udContentTypeChangedErrorComponent() {
        function link(scope, element, attr, ctrl) {
            
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udcontenttypechangederror/udcontenttypechangederror.html',
            scope: {
                'exceptionUdis': "=",
            },
            link: link
        };

        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udDependencyError', udDependencyErrorComponent);

    function udDependencyErrorComponent() {
        function link(scope, element, attr, ctrl) {
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/uddepencencyerror/uddependencyerror.html',
            scope: {
                'exception': "=",
                'feedbackMessageLevel': "=",
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udDeploySchemaMismatchError', udDeploySchemaMismatchErrorComponent);

    function udDeploySchemaMismatchErrorComponent(deployService) {
        function link(scope, element, attr, ctrl) {
            scope.prettyEntityType = function (udi) {
                return deployService.prettyEntityType(udi);
            }

            var contentItems = [];

            angular.forEach(scope.exception.ContentNames, function (contentName) {
                if (contentName !== null && contentName !== '' && !contentItems.includes(contentName)) {
                    contentItems.push(contentName);
                }
            });

            scope.contentItems = contentItems;
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/uddeployschemamismatcherror/uddeployschemamismatcherror.html',
            scope: {
                'exception': "=",
                'feedbackMessageLevel': "="
            },
            link: link
        };

        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udInvalidPathError', udInvalidPathErrorComponent);

    function udInvalidPathErrorComponent() {
        function link(scope, element, attr, ctrl) {
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udinvalidpatherror/udinvalidpatherror.html',
            scope: {
                'feedbackMessageLevel': "=",
                'exceptionUdis':"="
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udKabumError', udKabumErrorComponent);

    function udKabumErrorComponent() {
        function link(scope, element, attr, ctrl) {

        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udkabumerror/udkabumerror.html',
            scope: {
                'exception': "=",
                'exceptionUdis': "=",
            },
            link: link
        };

        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udMergeConflictError', udMergeConflictErrorComponent);

    function udMergeConflictErrorComponent() {
        function link(scope, element, attr, ctrl) {
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udmergeconflicterror/udmergeconflicterror.html',
            scope: {
                'exception': "=",
                'feedbackMessageLevel': "=",
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udRestoreSchemaMismatchError', udRestoreSchemaMismatchErrorComponent);

    function udRestoreSchemaMismatchErrorComponent() {
        function link(scope, element, attr, ctrl) {

            scope.prettyEntityType = function (udi) {
                var p1 = udi.indexOf('//');
                var p2 = udi.indexOf('/', p1 + 2);
                var n = udi.substr(p1 + 2, p2 - p1 - 2);
                n = n.replace('-', ' ');
                n = n.substr(0, 1).toUpperCase() + n.substr(1);
                return n;
            }
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udrestoreschemamismatcherror/udrestoreschemamismatcherror.html',
            scope: {
                'exception': "=",
                'noNodes': '=',
                'feedbackMessageLevel': "="
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udUnauthorizedClientError', udUnauthorizedClientErrorComponent);

    function udUnauthorizedClientErrorComponent() {
        function link(scope, element, attr, ctrl) {

        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udunauthorizedclienterror/udunauthorizedclienterror.html',
            scope: {
                
            },
            link: link
        };

        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udWebExceptionError', udWebExceptionErrorComponent);

    function udWebExceptionErrorComponent() {
        function link(scope, element, attr, ctrl) {
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/errors/udwebexceptionerror/udwebexceptionerror.html',
            scope: {
                'exception': "=",
                'feedbackMessageLevel': "=",
            },
            link: link
        };
        return directive;
    }
})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udRestoreComplete', udRestoreCompleteComponent);

    function udRestoreCompleteComponent() {

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/restore/udrestorecomplete/udrestorecomplete.html',
            scope: {
                'onBack': "&",
                'timestamp': "=",
                'serverTimestamp': "="
            }
        };

        return directive;

    }

})();
(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udRestoreProgress', udRestoreProgressComponent);

    function udRestoreProgressComponent() {

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/restore/udrestoreprogress/udrestoreprogress.html',
            scope: {
                'targetName': "=",
                'progress': "=",
                'currentActivity': "=",
                'timestamp': "=",
                'serverTimestamp': "="
            }
        };

        return directive;

    }

})();
(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udWorkspace', udWorkspaceComponent);

    function udWorkspaceComponent() {

        function link(scope, element, attr, ctrl) {
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/workspace/udworkspace/udworkspace.html',
            scope: {
                'name': '=',
                'type': '=',
                'current': '=',
                'active': '=',
                'isLast': '=',
                'deployProgress': "=",
                'showDetailsArrow': "=",
                'onClick': '&'
            },
            link: link
        };

        return directive;

    }

})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udWorkspaceAdd', udWorkspaceAddComponent);

    function udWorkspaceAddComponent() {

        function link(scope, element, attr, ctrl) {
            

        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/workspace/udworkspaceadd/udworkspaceadd.html',
            scope: {
                'onAddWorkspace': '&'
            },
            link: link
        };

        return directive;

    }

})();

(function() {
    'use strict';

    angular
        .module('umbraco.deploy.components')
        .directive('udWorkspaceInfo', udWorkspaceInfoComponent);

    function udWorkspaceInfoComponent() {

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: '/App_Plugins/Deploy/views/components/workspace/udworkspaceinfo/udworkspaceinfo.html',
            scope: {
                'websiteUrl': "@",
                'umbracoUrl': "@",
                'projectUrl': "@",
                'projectName': "@",
                'allowManageWorkspaces': "="
            }
        };

        return directive;

    }

})();

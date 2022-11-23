(function () {
    "use strict";
    function NoNodesController($scope, $http, $timeout, $q, deploySignalrService, deployHelper) {

        var vm = this;
        var baseUrl = Umbraco.Sys.ServerVariables.umbracoUrls.deployNoNodesBaseUrl;
        if (!baseUrl) {
            throw "No URL found for Deploy NoNodes API";
        }

        vm.restore = {};
        vm.logIsvisible = false;
        vm.restoreData = restoreData;
        vm.restoreSchema = restoreSchema;
        vm.showLog = showLog;
        vm.isDebug = Umbraco.Sys.ServerVariables.deploy.DebugEnabled;
        vm.requiresInitialization = vm.isDebug;
        vm.feedbackMessageLevel = 'Developer';

        function restoreSchema() {
            //reset the status to begin
            vm.restore.status = "";
            vm.restore.restoreMessage = "Initializing your website...";
            $http.post(baseUrl + 'CreateDiskReadTrigger')
                .then(function (response) {});
        }

        /**
         * When this loads we need to check for markers. Either the initialization or failed markers may be present
         * in which case we'll create a deploy marker to start the deployment process.
         */
        function checkInitMarker() {

            var deferred = $q.defer();

            $http.get(baseUrl + 'CheckMarkers')
                .then(function (response) {
                    if (Umbraco.Sys.ServerVariables.deploy.DebugEnabled) {
                        vm.requiresInitialization = true;
                    }
                    else {
                        //If OK is returned, that means
                        vm.restore.status = "ready";
                    }
                    deferred.resolve();
                }, function (response) {
                    if (response.status === 417) {
                        //If a 417 is returned it means we need to initialize
                        vm.requiresInitialization = true;
                    }
                    deferred.resolve();
                });

            return deferred.promise;
        }

        function restoreData() {

            var data = {
                SourceUrl: Umbraco.Sys.ServerVariables.deploy.Target.Url,
                EnableLogging: vm.enableWorkItemLogging
            };
            return $http.post(baseUrl + 'NoNodesRestore', data)
                .then(function (response) {
                    vm.step = "restoreWebsite";
                    vm.sessionId = response.data.SessionId;
                    if (vm.enableWorkItemLogging) {
                        vm.restore.showDebug = true;
                    }
                },
                function (response) {

                    vm.restore.status = "failed";

                    vm.restore = {
                        'error': {
                            hasError: true,
                            exceptionMessage: response.data.ExceptionMessage,
                            log: response.data.StackTrace,
                            exception: response.data.Exception
                        }
                    };
                });
        }

        function showLog() {
            vm.logIsvisible = true;
        }

        function init() {
            vm.restore = {
                'restoreMessage': "Restoring your website...",
                'restoreProgress': 0,
                'currentActivity': '',
                'status': '',
                'error': {},
                'trace': '',
                'showDebug': false
            };

            if (!vm.isDebug) {
                $timeout(function () {
                    checkInitMarker().then(function () {
                        //if we are not in debug just start
                        if (!vm.isDebug) {
                            restoreSchema();
                        }
                    });
                }, 1000);
            }
        }

        function updateRestoreArgs(event, args) {

            vm.restore.restoreProgress = args.percent;
            vm.restore.currentActivity = args.comment;
            vm.restore.status = deployHelper.getStatusValue(args.status);
            vm.restore.timestamp = new Date().toString();

            if (vm.restore.status === 'failed' ||
                vm.restore.status === 'cancelled' ||
                vm.restore.status === 'timedOut') {
                vm.restore.error = {
                    hasError: true,
                    comment: args.comment,
                    log: args.log,
                    exception: args.exception
                };
            }
        }

        //listen for the restore data
        $scope.$on('restore:sessionUpdated', function (event, args) {
            $scope.$apply(function () {
                updateRestoreArgs(event, args);
            });
        });

        //listen for the schema data to complete - this deployments starts as soon as this view loads
        //once that is done we'll present the Restore step
        $scope.$on('restore:diskReadSessionUpdated', function (event, args) {
            $scope.$apply(function () {
                updateRestoreArgs(event, args);

                //when this is done, show the restore step
                if (vm.restore.status === "completed") {
                    vm.restore.status = "ready";
                    vm.restore.restoreMessage = "Restoring your website...";
                }
            });
        });

        // signalR heartbeat
        $scope.$on('restore:heartbeat', function (event, args) {
            $scope.$apply(function () {
                if(vm.restore) {
                    vm.restore.timestamp = new Date().toString();
                }
            });
        });

        // where is angularHelper ?!
        vm.safeApply = function (scope, fn) {
            if (scope.$$phase || scope.$root.$$phase) {
                if (angular.isFunction(fn)) {
                    fn();
                }
            } else {
                if (angular.isFunction(fn)) {
                    scope.$apply(fn);
                } else {
                    scope.$apply();
                }
            }
        }

        // signalR debug heartbeat
        $scope.$on('deploy:heartbeat', function (event, args) {
            if (vm.sessionId !== args.sessionId) return;
            vm.safeApply($scope, function () {
                vm.restore.trace += "❤<br />";
            });
        });

        vm.showDebug = function () {
            vm.restore.showDebug = !vm.restore.showDebug;
        };

        var search = window.location.search;
        vm.enableWorkItemLogging = search === '?ddebug';

        // debug

        // beware, MUST correspond to what's in WorkStatus
        var workStatus = ["Unknown", "New", "Executing", "Completed", "Failed", "Cancelled", "TimedOut"];

        function updateLog(event, sessionUpdatedArgs) {

            // make sure the event is for us
            if (vm.sessionId === sessionUpdatedArgs.sessionId) {
                vm.safeApply($scope, function () {
                    var progress = sessionUpdatedArgs;
                    vm.restore.trace += "" + progress.sessionId.substr(0, 8) + " - " + workStatus[progress.status] + ", " + progress.percent + "%"
                        + (progress.comment ? " - <em>" + progress.comment + "</em>" : "") + "<br />";
                    if (progress.log)
                        vm.restore.trace += "<br />" + filterLog(progress.log) + "<br /><br />";
                    //console.log("" + progress.sessionId.substr(0, 8) + " - " + workStatus[progress.status] + ", " + progress.percent + "%");
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

        // note: due to deploy.service also broadcasting at beginning, the first line could be duplicated
        $scope.$on('deploy:sessionUpdated', updateLog);
        $scope.$on('restore:sessionUpdated', updateLog);

        init();
    }
    angular.module("umbraco.nonodes").controller("Umbraco.NoNodes.Controller", NoNodesController);
})();

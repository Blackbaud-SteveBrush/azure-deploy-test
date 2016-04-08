(function (angular) {
    'use strict';

    angular.module('capabilities-catalog').directive('markdownField', ['$parse', function (parse) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {

                // We use $parse to avoid hardcoding a scope attribute here.
                var setter = parse(attrs.ngModel).assign;

                // Only initialize the $.markdown plugin once.
                if (! element.hasClass('processed')) {
                    element.addClass('processed');

                    // Setup the markdown WYSIWYG.
                    element.markdown({
                        autofocus: false,
                        saveable: false,
                        iconlibrary: 'fa',
                        onChange: function(event) {
                            // When a change occurs, we need to update scope incase
                            // the user clicked one of the plugin buttons (which
                            // isn't the same as a keydown event that angular would
                            // listen for).
                            setter(scope, event.getContent());
                        }
                    });
                }
            }
        };
    }]);

    function PageFormController($scope, $state, $sce, CapabilityService, PageService) {
        var vm;
        vm = this;
        vm.isFieldAuthorized = $scope.$parent.appCtrl.isAuthorized('EDIT_CAPABILITY:FULL');
        vm.formData = {
            content: {
                markdown: ""
            }
        };

        function processError(data) {
            vm.error = data.error.message;
            if (data.error.code === 5) {
                vm.needsLogin = true;
            }
        }

        // Get the page information if we're editing.
        if ($state.params.capabilityId) {
            vm.formData.capabilityId = $state.params.capabilityId;
            if ($state.params.pageId) {
                PageService.setCapabilityId($state.params.capabilityId).getById($state.params.pageId).then(function (data) {
                    vm.formData = data.page;
                    vm.formData.capabilityId = vm.formData.capability._id;
                    vm.formData.originalCapabilityId = vm.formData.capability._id;
                    vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_PAGE:PARTIAL');
                    vm.isReady = true;
                });
            } else {
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_PAGE');
                vm.isReady = true;
            }
        } else {
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_PAGE');
            vm.isReady = true;
        }

        // Get any available capabilities.
        vm.capabilityOptions = [];
        CapabilityService.getAll().then(function (data) {
            var options;
            options = [];
            data.capabilityGroups.forEach(function (group) {
                group.capabilities.forEach(function (capability) {
                    options.push({
                        name: capability.name,
                        value: capability._id
                    });
                });
            });
            vm.capabilityOptions = options;
        });

        // Submitting the form.
        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            PageService.update(vm.formData).then(function (data) {
                if (data.success) {
                    if ($state.params.pageId) {
                        vm.success = 'Page successfully updated. <a href="#/capability/' + data.capability.slug + '/' + data.page.slug + '">View</a>';
                    } else {
                        vm.success = 'Page successfully created. <a href="#/capability/' + data.capability.slug + '/' + data.page.slug + '">View</a>';
                    }
                } else {
                    processError(data);
                }
                vm.scrollToTop = true;
            });
        };

        vm.delete = function () {
            PageService.setCapabilityId(vm.formData.capability._id).drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    processError(data);
                }
            });
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };
    }

    PageFormController.$inject = [
        '$scope',
        '$state',
        '$sce',
        'CapabilityService',
        'PageService'
    ];

    angular.module('capabilities-catalog')
        .controller('PageFormController', PageFormController);

}(window.angular));

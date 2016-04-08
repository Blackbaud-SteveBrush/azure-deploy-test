(function (angular) {
    'use strict';

    function ccLoginForm() {
        return {
            restrict: 'E',
            scope: true,
            bindToController: {
                onSuccess: '='
            },
            controller: 'LoginFormController as formCtrl',
            templateUrl: '../public/app/components/forms/login/login-form.html'
        };
    }

    function LoginFormController($sce, SessionService) {
        var vm;
        vm = this;

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            SessionService.login(vm.formData).then(function (data) {
                if (data.error) {
                    vm.error = data.error.message;
                }
                if (data.authenticated) {
                    SessionService.authenticate(data.authenticated);
                    if (vm.onSuccess) {
                        vm.onSuccess.call({});
                    }
                }
            });
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };
    }

    LoginFormController.$inject = [
        '$sce',
        'SessionService'
    ];

    angular.module('capabilities-catalog')
        .controller('LoginFormController', LoginFormController)
        .directive('ccLoginForm', ccLoginForm);

}(window.angular));

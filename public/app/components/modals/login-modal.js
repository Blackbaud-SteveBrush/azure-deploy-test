(function (angular) {
    'use strict';

    function LoginModalController($scope, $timeout) {
        var vm;

        vm = this;

        vm.login = function () {
            $timeout(function() {
                angular.element(document.querySelector('#form-login')).triggerHandler('submit');
            }, 100);
        };

        vm.onSuccess = function () {
            $scope.$dismiss('cancel');
            alert("Log in successful. You may now submit your changes.");
        };
    }

    LoginModalController.$inject = [
        '$scope',
        '$timeout'
    ];


    angular.module('capabilities-catalog')
        .controller('LoginModalController', LoginModalController);

}(window.angular));

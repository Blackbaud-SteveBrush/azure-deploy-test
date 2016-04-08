(function (angular) {
    'use strict';

    function LoginPageController($state, $window) {
        var vm;
        vm = this;
        vm.redirect = function () {
            $state.go('home');
            $window.location.reload();
        };
    }

    LoginPageController.$inject = [
        '$state',
        '$window'
    ];

    angular.module('capabilities-catalog')
        .controller('LoginPageController', LoginPageController);
        
}(window.angular));

(function (angular) {
    'use strict';

    function ConfigLocalStorage(bbOmnibarConfig, localStorageServiceProvider) {
        var host,
            needle;

        localStorageServiceProvider.setPrefix('capabilities-catalog');

        host = window.location.hostname;
        needle = 'blackbaud.com';

        bbOmnibarConfig.serviceName = 'Capabilities Catalog';

        // If the host is not white-listed, load the DEV version of the omnibar library.
        if (host.indexOf(needle, host.length - needle.length) === -1) {
            bbOmnibarConfig.url = 'https://bbauth-signin-cdev.blackbaudhosting.com/omnibar.min.js';
        } else {
            bbOmnibarConfig.url = 'https://signin.blackbaud.com/omnibar.min.js';
        }
    }

    function Run($rootScope, SessionService) {
        $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams, options) {
            if (fromState.url !== '^') {
                SessionService.setIsAuthenticated(false);
            }
        });
    }

    function ConfigRoutes($stateProvider, $urlRouterProvider) {

        $urlRouterProvider.otherwise('/');

        $stateProvider
            .state('home', {
                url: '/',
                templateUrl: '../public/app/views/home/home.html'
            })
            .state('capability', {
                url: '/capability/:capabilitySlug',
                templateUrl: '../public/app/views/capability/detail/capability-detail.html',
                controller: 'CapabilityDetailController as detailCtrl'
            })
            .state('capability-form', {
                url: '/capability-form/:capabilityId',
                templateUrl: '../public/app/views/capability/form/capability-form.html',
                controller: 'CapabilityFormController as formCtrl'
            })
            .state('capability-group-form', {
                url: '/capability-group-form/:capabilityGroupId',
                templateUrl: '../public/app/views/capability-group/form/capability-group-form.html',
                controller: 'CapabilityGroupFormController as formCtrl'
            })
            .state('login', {
                url: '/login/',
                templateUrl: '../public/app/views/login/login-page.html',
                controller: 'LoginPageController as pageCtrl'
            })
            .state('page', {
                url: '/capability/:capabilitySlug/:pageSlug',
                templateUrl: '../public/app/views/page/detail/page-detail.html',
                controller: 'PageDetailController as pageCtrl'
            })
            .state('page-form', {
                url: '/page-form/capability/:capabilityId/page/:pageId',
                templateUrl: '../public/app/views/page/form/page-form.html',
                controller: 'PageFormController as formCtrl'
            })
            .state('product-form', {
                url: '/product-form/:productId',
                templateUrl: '../public/app/views/product/form/product-form.html',
                controller: 'ProductFormController as formCtrl',
                params: { productGroupId: null }
            })
            .state('product-group-form', {
                url: '/product-group-form/:productGroupId',
                templateUrl: '../public/app/views/product-group/form/product-group-form.html',
                controller: 'ProductGroupFormController as formCtrl'
            });
    }

    function AppController($state, $window, bbModal, SessionService) {
        var vm;
        vm = this;
        vm.isAuthorized = SessionService.isAuthorized;
        vm.isAuthenticated = SessionService.isAuthenticated;
        vm.logout = function () {
            SessionService.logout();
            $state.go('home');
            $window.location.reload();
        };
        vm.openLoginModal = function () {
            bbModal.open({
                controller: 'LoginModalController as contentCtrl',
                templateUrl: '../public/app/components/modals/login-modal.html'
            });
        };
    }

    AppController.$inject = [
        '$state',
        '$window',
        'bbModal',
        'SessionService'
    ];

    ConfigLocalStorage.$inject = [
        'bbOmnibarConfig',
        'localStorageServiceProvider'
    ];

    ConfigRoutes.$inject = [
        '$stateProvider',
        '$urlRouterProvider'
    ];

    Run.$inject = [
        '$rootScope',
        'SessionService'
    ];


    angular.module('capabilities-catalog', [
        'sky',
        'ui.router',
        'ngSanitize',
        //'dndLists',
        'ng-sortable',
        'LocalStorageModule',
        'capabilities-catalog.templates'
    ])
        .config(ConfigLocalStorage)
        .config(ConfigRoutes)
        .run(Run)
        .controller('AppController', AppController)
        .config(['$compileProvider', function ($compileProvider) {
            $compileProvider.debugInfoEnabled(false);
        }]);

}(window.angular));

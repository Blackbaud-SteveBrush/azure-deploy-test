(function (angular) {
    'use strict';

    function utils() {
        return {
            assignShieldClasses: function (products) {
                products.forEach(function (product) {
                    try {
                        product.class = 'status-' + product.adoptionStatus.order;
                    } catch (e) {}
                });
                return products;
            },
            cleanArray: function (arr) {
                var i;
                for (i = 0; i < arr.length; ++i) {
                    if (arr[i] === undefined) {
                        arr.splice(i, 1);
                        i--;
                    }
                }
                return arr;
            }
        };
    }

    angular.module('capabilities-catalog')
        .factory('utils', utils);
}(window.angular));

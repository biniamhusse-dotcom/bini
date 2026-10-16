'use strict';

Bahmni.Clinical.Order = (function () {
    var Order = function (data) {
        angular.extend(this, data);
        this.dateCreated = data.dateCreated;
    };

    var getName = function (test) {
        var name = _.find(test.names, {conceptNameType: "SHORT"}) || _.find(test.names, {conceptNameType: "FULLY_SPECIFIED"});
        return name ? name.name : undefined;
    };

    Order.create = function (test, orderTypeName) {
        var order = new Order({
            uuid: undefined,
            concept: {
                uuid: test.uuid,
                displayName: getName(test)
            },
            orderTypeName: orderTypeName || null,
            conceptClassName: (test.conceptClass && test.conceptClass.name) || null
        }
        );
        return order;
    };

    Order.revise = function (order) {
        var revisedOrder = new Order({
            concept: order.concept,
            action: Bahmni.Clinical.Constants.orderActions.revise,
            previousOrderUuid: order.uuid,
            isDiscontinued: false,
            commentToFulfiller: order.commentToFulfiller,
            urgency: order.urgency,
            conceptClassName: order.conceptClassName,
            orderTypeName: order.orderTypeName
        });
        return revisedOrder;
    };

    Order.discontinue = function (order) {
        var discontinuedOrder = new Order({
            concept: order.concept,
            action: Bahmni.Clinical.Constants.orderActions.discontinue,
            previousOrderUuid: order.uuid,
            commentToFulfiller: order.commentToFulfiller,
            urgency: order.urgency,
            conceptClassName: order.conceptClassName,
            orderTypeName: order.orderTypeName
        });
        return discontinuedOrder;
    };

    return Order;
})();

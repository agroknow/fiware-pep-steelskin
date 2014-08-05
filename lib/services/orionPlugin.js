/*
 * Copyright 2013 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of fiware-orion-pep
 *
 * fiware-orion-pep is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * fiware-orion-pep is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with fiware-orion-pep.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[daniel.moranjimenez@telefonica.com]
 */

'use strict';

var sax = require('sax'),
    errors = require('../errors');

/**
 * Translates the updateAction value to the appropriate action name for the Access Controller.
 *
 * @param originalAction        String with the action name.
 */
function translateAction(originalAction) {
    var action;

    switch(originalAction.toUpperCase()) {
        case 'APPEND':
            action = 'create';
            break;

        case 'UPDATE':
            action = 'update';
            break;

        case 'DELETE':
            action = 'delete';
            break;
    }

    return action;
}

/**
 * Extract the action from an XML body.
 *
 * @param body          Raw string payload.
 */
function inspectBodyXML(body, callback) {
    var parser = sax.parser(true),
        readingAction = false,
        action;

    parser.onerror = function (e) {
        var error = new errors.WrongXmlPayload();

        error.moreInfo = e;
        callback(error);
    };

    parser.ontext = function (t) {
        if (readingAction) {
            if (!action) {
                action = t;
            } else {
                action = action + t;
            }
        }
    };

    parser.onopentag = function (node) {
        if (node.name === 'updateAction') {
            readingAction = true;
        } else {
            readingAction = false;
        }
    };

    parser.onend = function () {
        if (action) {
            callback(null, translateAction(action.trim()));
        } else {
            callback(new errors.WrongXmlPayload());
        }
    };

    parser.write(body).close();
}

/**
 * Extract the action from a JSON body.
 *
 * @param body          Javascript Object with the parsed payload.
 */
function inspectBodyJSON(body, callback) {
    if (body && body.updateAction) {
        callback(null, translateAction(body.updateAction));
    } else {
        callback(new errors.WrongJsonPayload());
    }
}

/**
 * Determines what kind of body to parse to calculate the action, and invoke the appropriate function.
 *
 * @param req           Incoming request.
 * @param res           Outgoing response.
 */
function inspectBody(req, res, callback) {
    var actionHandler = function actionHandler(error, action) {
        req.action = action;
        callback(error, req, res);
    };

    if (req.headers['content-type'] === 'application/json') {
        return inspectBodyJSON(req.body, actionHandler);
    } else if (req.headers['content-type'] === 'application/xml' || req.headers['content-type'] === 'text/xml') {
        return inspectBodyXML(req.rawBody, actionHandler);
    } else {
        actionHandler();
    }
}

/**
 * Determines what is the requested action based on the URL.
 *
 * @param req           Incoming request.
 * @param res           Outgoing response.
 */
function inspectUrl(req, res, callback) {
    var error = null;

    if (req.url.toLowerCase().indexOf('/ngsi10/querycontext') >= 0) {
        req.action = 'read';
    } else if (req.url.toLowerCase().indexOf('/ngsi10/subscribecontext') >= 0) {
        req.action = 'subscribe';
    } else if (req.url.toLowerCase().indexOf('/ngsi9/registercontext') >= 0) {
        req.action = 'register';
    } else if (req.url.toLowerCase().indexOf('/nsgi9/discovercontextavailability') >= 0) {
        req.action = 'discover';
    } else if (req.url.toLowerCase().indexOf('/ngsi9/subscribecontextavailability') >= 0) {
        req.action = 'subscribe-availability';
    } else {
        error = new errors.ActionNotFound();
    }

    callback(error, req, res);
}

/**
 * Middleware to calculate what Context Broker action has been received based on the path and the request payload.
 *
 * @param req           Incoming request.
 * @param res           Outgoing response.
 */
function extractCBAction(req, res, callback) {
    if (req.url.toLowerCase().indexOf('/ngsi10/updatecontext') >= 0) {
        inspectBody(req, res, callback);
    } else {
        inspectUrl(req, res, callback);
    }
}

exports.extractCBAction = extractCBAction;
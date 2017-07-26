"use strict";

const request = require("request");
const key = require("./atlassian-connect").key;

function getTenant(req, httpClient, cb) {
  httpClient.get({
    uri: `/rest/atlassian-connect/1/addons/${key}/properties/tenant`,
    json: true,
  }, (err, ires, body) => {
    if (err) { return cb(err); }
    req.tenant = body.value;
    cb(null, req.tenant);
  });
}

function getPid(req, httpClient, cb) {
  if (req.query.issue) {
    httpClient.get({
      uri: `/rest/api/2/issue/${req.query.issue}/properties/dynatraceProblemId`,
      json: true,
    }, (err, ires, body) => {
      if (err) { return cb(err); }
      req.pid = body.value;
      cb(null, req.pid);
    });
  } else {
    cb();
  }
}

function getProblemDetails(tenant, token, pid, cb) {
  request.get({
    uri: `${tenant}/api/v1/problem/details/${pid}`,
    headers: {
      Authorization: `Api-Token ${token}`,
    },
    json: true,
  }, cb);
}

function addProblemComment(tenant, token, pid, comment, user, context, cb) {
  request.post({
    uri: `${tenant}/api/v1/problem/details/${pid}/comments`,
    headers: {
      Authorization: `Api-Token ${token}`,
    },
    json: `{"comment": "${comment}", "user" : "${user}", "context" : "${context}"}`,
  }, cb);  
}

const modifiers = {
  SYNTHETIC: "#monitors/webcheckdetail;webcheckId",
  HOST: "#hostdetails;id",
  APPLICATION: "#uemappmetrics;uemapplicationId",
  MOBILE_APPLICATION: "#mobileappoverview;appId",
  SERVICE: "#services/servicedetails;id",
  PROCESS: "#processdetails;id",
  PROCESS_GROUP_INSTANCE: "#processdetails;id",
  PROCESS_GROUP: "#processgroupdetails;id",
  HYPERVISOR: "#hypervisordetails;id",
  SYNTHETIC_TEST: "#webcheckdetailV3;webcheckId",
  DCRUM_APPLICATION: "#entity;id",
};

function eventLink(tenant, event, pid) {
  const entityType = event.entityId.split("-")[0];
  const modifier = modifiers[entityType];

  if (!modifier) {
    console.log(entityType);
    return `${tenant}/#problems/problemdetails;pid=${pid}`;
  }

  return `${tenant}/${modifier}=${event.entityId};gtf=p_${pid};pid=${pid}`;
}

module.exports = {
  eventLink,
  getTenant,
  getPid,
  getProblemDetails,
  addProblemComment,
}
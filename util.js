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

module.exports = {
  getTenant,
  getPid,
  getProblemDetails,
  addProblemComment,
};


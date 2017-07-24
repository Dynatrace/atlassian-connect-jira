// Canned functionality for JIRA Activity
$(function() {
  "use strict";

  // Get parameters from query string
  // and stick them in an object
  function getQueryParams(qs) {
    qs = qs.split("+").join(" ");

    var params = {}, tokens,
    re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(qs)) {
      params[decodeURIComponent(tokens[1])] =
        decodeURIComponent(tokens[2]);
    }

    return params;
  }

  AP.define('JiraActivity', {
    buildProjectTable: function(projects, selector) {

      var params = getQueryParams(document.location.search);
      var baseUrl = params.xdm_e + params.cp;

      function buildTableAndReturnTbody(hostElement) {
        var projTable = hostElement.append('table')
          .classed({'project': true, 'aui': true});

        // table > thead > tr, as needed below
        var projHeadRow = projTable.append("thead").append("tr");
        // Empty header
        projHeadRow.append("th");
        // Now for the next column
        projHeadRow.append("th").text("Key");
        projHeadRow.append("th").text("Name");

        return projTable.append("tbody");
      }

      var projectBaseUrl = baseUrl + "/browse/";

      var rootElement = d3.select(selector);
      var projBody = buildTableAndReturnTbody(rootElement);

      // For each data item in projects
      var row = projBody.selectAll("tr")
        .data(projects)
        .enter()
        .append("tr");

      // Add a td for the avatar, stick a span in it
      row.append("td").append('span')
        // Set the css classes for this element
        .classed({'aui-avatar': true, 'aui-avatar-xsmall': true})
        .append('span')
        .classed({'aui-avatar-inner': true})
        .append('img')
        // Set the atribute for the img element inside this td > span > span
        .attr('src', function(item) { return item.avatarUrls["16x16"] });

      // Add a td for the project key
      row.append("td").append('span')
        .classed({'project-key': true, 'aui-label': true})
        // set the content of the element to be some text
        .text(function(item) { return item.key; });

      // And finally, a td for the project name & link
      row.append("td").append('span')
        .classed({'project-name': true})
        .append("a")
        // make the name a link to the project
        .attr('href', function(item) { return projectBaseUrl + item.key; })
        // since we're in the iframe, we need to set _top
        .attr('target', "_top")
        .text(function(item) { return item.name; });
    }
  });
});

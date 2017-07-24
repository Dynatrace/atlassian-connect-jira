/* add-on script */
// MyAddon functionality
$(function() {
 // Call REST API via the iframe
 // Bridge functionality
 // JiraActivity is registered by an external script that was included
 AP.require(['request', 'JiraActivity'], function(request, JiraActivity) {
     request({
         url: '/rest/api/2/project',
         success: function(response) {
             // Convert the string response to JSON
             response = JSON.parse(response);

             // Call your helper function to build the
             // table, now that you have the data
             JiraActivity.buildProjectTable(response, ".projects");
         },
         error: function(response) {
             console.log("Error loading API (" + uri + ")");
             console.log(arguments);
         },
         contentType: "application/json"
     });
 });
});

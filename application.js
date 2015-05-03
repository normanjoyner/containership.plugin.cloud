var ContainershipPlugin = require("containership.plugin");
var leader = require([__dirname, "lib", "leader"].join("/"));
var follower = require([__dirname, "lib", "follower"].join("/"));

module.exports = new ContainershipPlugin({
    type: "core",
    name: "cloud",

    initialize: function(core){
        core.logger.register("containership-cloud");

        if(core.options.mode == "leader")
            leader.initialize(core, this.config);
        else
            follower.initialize(core, this.config);
    },

    reload: function(){}
});

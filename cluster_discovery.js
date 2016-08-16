var fs = require("fs");
var _ = require("lodash");
var async = require("async");
var request = require("request");

module.exports = {

    discover: function(callback) {
        var config = {};

        fs.readFile([process.env.HOME, ".containership", "cloud.json"].join("/"), function(err, content) {
            if (err) {
                return callback(err);
            }

            try {
                config = JSON.parse(content);
            } catch(err) {
                return callback(err);
            }

            fs.readFile(["", "opt", "containership", "cluster_id"].join("/"), function(err, content) {
                if(err) {
                    return callback(err);
                }

                try {
                    config = _.merge(config, JSON.parse(content));
                } catch(err) {
                    return callback(err);
                }

                containership_cloud.get_configuration(config, function(err, response) {
                    if(err) {
                        return callback(err);
                    } else if(!cloud[response.general.provider]) {
                        return callback(new Error("Provider does not exist!"));
                    }

                    return callback(null, cloud[response.general.provider].parse(response));
                });
            });

        });

        var containership_cloud = {

            get_configuration: function(config, fn){
                var options = {
                    baseUrl: process.env.CONTAINERSHIP_CLOUD_ENV === "development" ? "https://stage-api.containership.io" : "https://api.containership.io",
                    url: ["", "v2", "organizations", config.organization, "clusters", config.cluster_id, "configuration"].join("/"),
                    method: "GET",
                    timeout: 10000,
                    headers: {
                        Authorization: ["Bearer", config.api_key].join(" ")
                    },
                    json: true
                }

                request(options, function(err, response){
                    if(err)
                        return fn(err);
                    else if(response.statusCode != 200)
                        return fn(new Error(response.body));
                    else
                        return fn(null, response.body);
                });
            }

        }

        var cloud = {

            aws: {
                parse: function(configuration){
                    var ip_addresses = _.flatten([
                        _.pluck(configuration.leaders.instances, "PrivateIpAddress"),
                        _.pluck(configuration.followers.instances, "PrivateIpAddress")
                    ]);

                    return _.map(ip_addresses, function(ip_address){
                        ip_address = [ip_address, "32"].join("/");
                        return ip_address;
                    });
                }
            },

            do: {
                parse: function(configuration){
                    var ip_addresses = _.flatten([
                        _.map(configuration.leaders.instances, function(instance){
                            if(_.isNull(instance))
                                return;

                            var ip_address = null;
                            _.each(instance.networks.v4, function(network){
                                if(network.type == "private")
                                    ip_address = network.ip_address;
                            });

                            ip_address = [ip_address, "32"].join("/");
                            return ip_address;
                        }),
                        _.map(configuration.followers.instances, function(instance){
                            if(_.isNull(instance))
                                return;

                            var ip_address = null;
                            _.each(instance.networks.v4, function(network){
                                if(network.type == "private")
                                    ip_address = network.ip_address;
                            });

                            ip_address = [ip_address, "32"].join("/");
                            return ip_address;
                        })
                    ]);

                    return _.compact(ip_addresses);
                }
            },

            joy: {
                parse: function(configuration){
                    return _.flatten([
                        _.map(configuration.leaders.instances, function(instance){
                            var ip_address = _.without(instance.ips, instance.primaryIp);
                            ip_address = [ip_address, "32"].join("/");
                            return ip_address;
                        }),
                        _.map(configuration.followers.instances, function(instance){
                            var ip_address = _.without(instance.ips, instance.primaryIp);
                            ip_address = [ip_address, "32"].join("/");
                            return ip_address;
                        })
                    ]);
                }
            },

            pkt: {
                parse: function(configuration){
                    return _.flatten([
                        _.map(configuration.leaders.instances, function(instance){
                            var ip_address = _.find(instance.ip_addresses, function(ip){
                                return !ip.public;
                            });
                            ip_address = [ip_address.address, "32"].join("/");
                            return ip_address;
                        }),
                        _.map(configuration.followers.instances, function(instance){
                            var ip_address = _.find(instance.ip_addresses, function(ip){
                                return !ip.public;
                            });
                            ip_address = [ip_address.address, "32"].join("/");
                            return ip_address;
                        })
                    ]);
                }
            },

            rsp: {
                parse: function(configuration){
                    return _.flatten([
                        _.map(configuration.leaders.instances, function(instance){
                            return [_.first(instance.addresses.private).addr, "32"].join("/");
                        }),
                        _.map(configuration.followers.instances, function(instance){
                            return [_.first(instance.addresses.private).addr, "32"].join("/");
                        })
                    ]);
                }
            },

            google_cloud: function(configuration) {
                var ips = _.map(_.flatten([configuration.leaders.instances, configuration.followers.instances]), function(instance) {
                    if(instance.metadata && instance.metadata.networkInterfaces) {
                        var nics = _.indexBy(instance.metadata.networkInterfaces, "name");
                        return nics.nic0 && [nics.nic0.networkIP, "32"].join("/");
                    }
                });

                return _.compact(ips);
            }
        }

        cloud.amazon_web_services = cloud.aws;
        cloud.digital_ocean = cloud.do;
        cloud.joyent = cloud.joy;
        cloud.packet = cloud.pkt;
        cloud.rackspace = cloud.rsp;
    }

}

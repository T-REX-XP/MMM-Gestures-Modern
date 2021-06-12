/*
 * MMM-Gestures is a third party Magic Mirror 2 Module
 *
 * By Thomas Bachmann (https://github.com/thobach)
 *
 * License: MIT
 *
 * The module consists of two roles:
 * 1) Server role, written in Node.js (gestures.js)
 * 2) Client role, written in Javascript (this file)
 *
 * The communication between the two roles happens via WebSocket protocol.
 *
 * Other modules can receive gestures via Magic Mirror 2's notification mechanism using
 * the notificationReceived() function.
 */
Module.register('MMM-Gestures', {
    requiresVersion: '2.1.0',
    defaults: {
        presenceIndicator: "fa-eye",
        presenceIndicatorColor: "red",
        presenceOffIndicatorColor: "dimgray",
        powerSaving: true,
        powerSavingNotification: true,
        powerSavingMessage: "Monitor will be turn Off by MMM-Geustures module"
    },
    userPresence: false,
    getStyles: function() {
        return [
            'font-awesome.css'
        ];
    },
    getDom: function() {
        var wrapper = document.createElement("i");
        if (this.userPresence) {
            if (this.config.presenceIndicator && this.config.presenceIndicatorColor) {
                wrapper.className = "fas " + this.config.presenceIndicator;
                wrapper.style = "color: " + this.config.presenceIndicatorColor + ";";
            }
        } else {
            if (this.config.presenceOffIndicator && this.config.presenceOffIndicatorColor) {
                wrapper.className = "fas " + this.config.presenceOffIndicator;
                wrapper.style = "color: " + this.config.presenceOffIndicatorColor + ";";
            }
        }
        return wrapper;
    },

    // init connection to server role and setup compliment module hiding/showing upon
    // events
    start: function() {
        Log.info('MMM-Gestures start invoked.');
        // notifications are only received once the client (this file) sends the first message to the server (node_helper.js)
        this.sendSocketNotification("INIT", this.config);
    },

    // hide compliment module by default, until PRESENT gesture is received
    notificationReceived: function(notification, payload, sender) {
        // hide compliment module by default after all modules were loaded
        if (notification == 'ALL_MODULES_STARTED') {
            var complimentModules = MM.getModules().withClass('compliments');
            if (complimentModules && complimentModules.length == 1) {
                Log.info('Hiding compliment module since all modules were loaded.');
                var compliment = complimentModules[0];
                compliment.hide();
            }
        }
    },


    // Override socket notification handler.
    // On message received from gesture server forward message to other modules
    // and hide / show compliment module
    socketNotificationReceived: function(notification, payload) {
        var config = this.config;
        Log.info('Received message from gesture server: ' + notification + ' - ' + payload);
        // forward gesture to other modules
        this.sendNotification('GESTURE', { gesture: payload });
        if (config.showMessageWithReceivedGuesture) {
            this.sendNotification("SHOW_ALERT", { type: "notification", title: "Title", message: "Received gesture:" + payload, timer: 3000 });
        }
        // interact with compliments module upon PRESENT and AWAY gesture
        var complimentModules = MM.getModules().withClass('compliments');
        if (complimentModules && complimentModules.length == 1) {

            var compliment = complimentModules[0];
            switch (payload) {
                case 'PRESENT':
                    Log.info('Showing compliment after having received PRESENT gesture.');
                    this.userPresence = true;
                    this.updateDom();
                    //compliment.show();
                    break;
                case 'AWAY':
                    Log.info('Hiding compliment after having received AWAY gesture.');
                    this.userPresence = false;
                    if (this.config.powerSavingNotification === true) {
                        this.sendNotification("SHOW_ALERT", { type: "notification", message: this.config.powerSavingMessage });
                    }
                    this.updateDom();
                    //compliment.hide();
                    break;
                    //Gestures
                case 'FAR':
                    // Log.info('Reloading page after having received FAR gesture.');
                    //location.reload();
                    break;
                case 'NEAR':
                    Log.info('Showing next page after having received NEAR gesture.');
                    //self.saveEnergy("PRESENT");
                    //this.sendNotification("PAGE_INCREMENT");
                    break;
                case 'LEFT':
                    Log.info('Showing next page after having received NEAR gesture.');
                    this.sendNotification("PAGE_DECREMENT", 1);
                    break;
                case 'RIGHT':
                    Log.info('Showing next page after having received NEAR gesture.');
                    this.sendNotification("PAGE_INCREMENT", 1);
                    break;
                default:
                    Log.info('Not handling received gesture in this module directly:');
                    Log.info(payload);
                    break;
            }
        }

        // interact with newsfeed module upon UP, DOWN, LEFT, RIGHT gesture
        //var newsfeedModules = MM.getModules().withClass('newsfeed');

        /* if (newsfeedModules) {
             var notification = "UNKNOWN";
 
             // reverting orders since sensor is usually built in upside down
             if (payload == 'LEFT') {
                 notification = "ARTICLE_NEXT";
             } else if (payload == 'RIGHT') {
                 notification = "ARTICLE_PREVIOUS";
             } else if (payload == 'UP') {
                 notification = "ARTICLE_LESS_DETAILS";
             } else if (payload == 'DOWN') {
                 notification = "ARTICLE_MORE_DETAILS";
             } else {
                 Log.info('Not handling received gesture in this module directly:');
                 Log.info(payload);
             }
 
             // forward gesture to other modules
             Log.info('Sending notification: ' + notification + '.');
             this.sendNotification(notification);
 
         }*/
    },
});
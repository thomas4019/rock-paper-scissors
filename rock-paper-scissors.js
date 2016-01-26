PlayersList = new Mongo.Collection('players');
// We store the current step in a collection, since Meteor doesn't provide an easy way to broadcast.
Time = new Mongo.Collection('time');

var WINS_AGAINST = {'Rock': 'Scissors', 'Paper': 'Rock', 'Scissors': 'Paper'};
var LOSES_TO = {'Rock': 'Paper', 'Paper': 'Scissors', 'Scissors': 'Rock'};
var NUM_STEPS = 5; // Number of seconds in each round.

if (Meteor.isClient) {

  // Ensure there is a Player for my url, and get the Mongo database id.
  var name = window.location.pathname.substring(1);
  Meteor.subscribe('players', function() {
    if (name) {
      var me = PlayersList.findOne({name: name});
      var id = me ? me._id : PlayersList.insert({name: name, score: 0});
      Session.set('myId', id);
    }
  });

  Template.body.events({
    'click .choice': function(event) {
      // Update the Player's chosen action.
      // TODO: Ignore clicks on other players buttons.
      var action = $(event.target).text();
      PlayersList.update(Session.get('myId'), { $set: { action: action } } );
    },
    'click #reset': function() {
      Meteor.call('reset');
    },
    'mousemove': function(event) {
      // Save mouse coordinates.
      if (Session.get('myId')) {
        PlayersList.update(Session.get('myId'), { $set: {'x': event.pageX, 'y': event.pageY } } );
      }
    },
  });
 
  Template.body.helpers({
    players: function() {
      return PlayersList.find({}, { sort: { name: 1 } } );
    },
    otherPlayers: function() {
      return PlayersList.find({ name: { $not: name } });
    },
    getMessage: function() {
      var time = Time.findOne();
      var step = time && time.step;
      var messages = ['5', '4', '3', '2', '1'];
      return messages[step];
    }
  });

  Template.player.helpers({
    getPlayerClass: function (id) {
      return (id == Session.get('myId')) ? 'me' : '';
    },
    getActionClass: function (playerAction, action) {
      return (action && playerAction == action) ? 'selected' : '';
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    PlayersList.remove({});
    Time.remove({});
    Time.insert({step: 0});
  });

  Meteor.publish('players', function() {
    return PlayersList.find();
  });

  Meteor.methods({
    reset: function() {
      // We do this on the server, because a client can only modify one document at a time.
      PlayersList.update({}, { $set : { score : 0 } }, {multi: true});
    }
  });

  Meteor.setInterval(function() {
    var lastStep = Time.findOne().step;
    if (lastStep == (NUM_STEPS - 1)) {
      // Round ended, calculate winner
      var counts = {'Rock': 0, 'Scissors': 0, 'Paper': 0};
      
      PlayersList.find().forEach(function(player) {
        counts[player.action] += 1;
      });
      PlayersList.find().forEach(function(player) {
        var action = player.action;
        var hitBy = counts[LOSES_TO[action]];
        var enemiesDefeated = counts[WINS_AGAINST[action]];
        // Players who were not attacked, get one point for each person they can attack.
        if (hitBy == 0 && enemiesDefeated > 0) {
          PlayersList.update(player._id, {$inc: {score: enemiesDefeated}});
        }
      });
      PlayersList.update({}, { $set : { action : null } }, {multi: true})
    }
    Time.update({}, {step: (lastStep + 1) % NUM_STEPS});
  }, 1000);
}

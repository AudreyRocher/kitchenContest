//CONSTANTES A APPELER POUR FAIRE FONCTIONNER LE SERVEUR
const favicon = require('serve-favicon');
const express = require('express');
const app = require('express')();
const pug = require('pug');
const path = require('path');
const session = require('express-session');
const server = require('http').Server(app); //protocole http pour démarrer avec socket io
const io = require('socket.io')(server, { wsEngine: 'ws' });
const MongoClient = require('mongodb').MongoClient;
const MongoDBStore = require('connect-mongodb-session')(session);
const URL = 'mongodb://localhost:27017';
const db = require('./mes_modules/db/db.js');

server.listen(80, function() {
  console.log('Serveur démarré, à l\'écoute sur le port 80');
});
//VARIABLES GLOBALES
var myDb; //ACCES A LA BASE DE DONNEES MONGO
var players; //collection joueurs dans la base de données
var recipe;
////////// FONCTIONS UTILES //////////
  //choisit un nombre random pour les recettes
  function chooseRandomNumbers(){
    return Math.floor(Math.random() * (31 - 1)) + 1;
  };

  //Compare des tableaux de reponses
  function getRightAnswers(list1, list2){
     var alreadyFound = false;
     var same = [];
     var longList;
     var shortList;
     // On vérifie quelle liste est la plus longue
     if(list1.length - list2.length >= 0){
         longList = list1;
         shortList = list2;
     }else if(list1.length - list2.length < 0){
         longList = list2;
         shortList = list1;
     }
     // On compare la 1ere liste à la 2e
     for(var i=0; i<longList.length; i++){
         for(var j=0; j<shortList.length; j++){
             // Si on tombe sur un doublon
             if(shortList[j] === longList[i]){
                 alreadyFound = false; // réinitialisation
                 // On vérifie que ce doublon n'a pas déjà été enregistré
                 for(var k=0; k<same.length; k++){
                     // Si ce doublon a déjà été enregistré
                     if(same[k] === longList[i]){
                         // On passe à l'élément suivant dans la 2eme liste
                         alreadyFound = true;
                         k = same.length;
                     }
                 }
                 // Si ce doublon n'a pas déjà été enregistré, on l'enregistre
                 if(alreadyFound !== true){
                     same.push(longList[i]);
                 }
             }
         }
     }
     return same.length;
  } // end getRightAnswers

  ////////// Fonction pour générer des nombres random uniques [1;31] intervalle d'id de recettes //////////
  function getRandomRecipe(howLong){
    var arrayofUsedNumbers = [];
    while(arrayofUsedNumbers.length <4){
      var randomSelection = chooseRandomNumbers();
      if(arrayofUsedNumbers.indexOf(randomSelection) > -1) continue;
      arrayofUsedNumbers[arrayofUsedNumbers.length] = randomSelection;
    }
    return arrayofUsedNumbers
  };

////////// FICHIERS STATIQUES A SERVIR //////////
app.set('view engine', 'pug');
app.set('views', __dirname + '/views');
app.use('/public', express.static(__dirname + '/public'));
app.use(favicon(path.join(__dirname, '/views/', 'favicon.ico')))

/* GESTION DES ROUTES */
////////// ROUTE PRINCIPALE POUR LA PAGE D'ACCUEIL //////////
app.get('/', function(req, res, next) {
  res.render('lobbynew');
});

////////// SOCKET IO ET CONNEXIONS EN TEMPS REEL //////////
var waitingRoom = []; //tableau dans lequel on stocke toutes les personnes qui se connectent
//var compteur = 0;//nombre de réponses reçues
//J'ouvre une connexion entre le serveur et le client
io.on('connection', function(socket){

////////// JE RENVOIE LE TABLEAU DES JOUEURS DEJA CONNECTES //////////
  socket.on('readyToSeeTheWaitingRoom', function(){
    socket.emit('envoyerLaWaitingRoom', waitingRoom);
  })

////////// JE CHERCHE DANS LA BASE LES MEILLEURS SCORES //////////
  socket.on('giveMeTheHighestScore', function(){
    db.connect(URL, function(err){
      myDb = db.get().db('jeumulti');
      players = myDb.collection('players');
        players.find(
          {
          }, {
            _id: 0, pseudo: 1, score: 1
          }).sort({score: -1, pseudo: 1}).limit(15).toArray(function(err, data){
            if(err){
              throw err;
            } else {
              socket.emit('hereAreTheHighestScores', {data});
            }
          });
      });
    });

////////// ECOUTE DES DONNEES PROVENANT DU FORMULAIRE D'INSCRIPTION //////////
  socket.on('joinWaitingRoom', function(newOne){
    db.connect(URL, function(err){
      myDb = db.get().db('jeumulti');
      players = myDb.collection('players');
        players.find({
          pseudo: {'$regex': newOne.pseudo, '$options': 'i'}
        }).toArray(function(err, data){
          if(data.length == 0){
            myDb.collection('players').insertOne({
              pseudo: newOne.pseudo,
              password: newOne.password,
              avatar: "https://api.adorable.io/avatars/80/" + newOne.pseudo,
              score: 0
            });//fin insertOne
          db.close();
          //Quand mon joueur est inscrit avec succès, je le renvoie dans la waitingRoom
            var player = {pseudo: newOne.pseudo, id: socket.id, avatar: "https://api.adorable.io/avatars/80/" + newOne.pseudo, score: 0}
          //  console.log(player);
            waitingRoom.push(player);
          //cet emit n'est visible que pour moi et pour gérer mon personnage
            socket.emit('newPlayerForCooking', {pseudo: newOne.pseudo, id: socket.id, avatar: "https://api.adorable.io/avatars/80/" + newOne.pseudo, score: 0, connected: true});
          //j'informe tout le monde sauf moi que je suis connecté
            socket.broadcast.emit('newPlayerForCooking', player);
          //Je créé une room à chaque fois que quelqu'un se connecte
            socket.join(newOne.pseudo);
            io.sockets.to(newOne.pseudo).emit('test', 'connecté à ' + newOne.pseudo);
          } else {
            socket.emit('pseudo invalide', 'ce nom est déjà pris !');// si la data existe, j'invite la personne à saisir un nouveau pseudo
          }
        });//fin toArray
    });//fin connect
  });//fin join waitingRoom


////////// ECOUTE DES DONNES PROVENANT D'UNE CONNEXION //////////
  socket.on('login', function(oldOne){
    db.connect(URL, function(err){
      myDb = db.get().db('jeumulti');
      players = myDb.collection('players');
      players.find({
        pseudo: oldOne.pseudo,
        password: oldOne.password
      }).toArray(function(err, data){
        if(err){
          throw err;
        }else{
          if(data[0] == undefined){
            socket.emit('pseudo invalide', 'Un trou de mémoire ?')
          } else{
          //Si j'ai bien une entrée en base, je connecte cette personne
            if(data[0] != undefined){
            //  console.log(data[0].pseudo);
              var playerC = {pseudo: data[0].pseudo, id: socket.id, avatar: data[0].avatar, score: data[0].score}
            //Je vérifie que la personne qui se connecte ne l'est pas déjà
              var index = waitingRoom.map(function(e){return e.pseudo;}).indexOf(data[0].pseudo);
            //Si l'index vaut -1, je ne suis pas connecté, je peux donc jouer au jeu
              if(index == -1){
                waitingRoom.push(playerC);
            //Cet emit n'est visible que pour moi et pour gérer mon personnage
                socket.emit('newPlayerForCooking', {pseudo: data[0].pseudo, id: socket.id, avatar: data[0].avatar, score: data[0].score, connected: true});
                socket.emit('justePourMoi', {pseudo: data[0].pseudo, id: socket.id, score: data[0].score}); ///Test pour avoir mes données personnelles
                socket.broadcast.emit('newPlayerForCooking', playerC);
            //Je crée une room pour moi
                socket.join(data[0].pseudo);
                io.sockets.to(data[0].pseudo).emit('test', 'connecté à ' + data[0].pseudo);
              } else {
                socket.emit('pseudo invalide', 'Petit malin, tu es déjà connecté !')
              }
            }
          }
        }
      }); //fin toArray
      db.close();
    })
  });

////////// ECOUTE DES DONNEES PROVENANT D'UNE DEMANDE DE JEU //////////
  socket.on('joinRoom', function(players){
    //console.log(players);//Objet contenant toutes les propriétés des joueurs
    var pseudoPlayer1;
    var avatarPlayer1;
    var idPlayer1;
    var pseudoPlayer2;
    var avatarPlayer2;
    var idPlayer2;
  //On rejoint la room sur laquelle on clique
    socket.join(players.roomName)
    for(index in waitingRoom){
      if(waitingRoom[index].pseudo == players.roomName){
        //console.log(index);
        waitingRoom[index].alreadyPlaying = true;
        pseudoPlayer1 = waitingRoom[index].pseudo;
        avatarPlayer1 = waitingRoom[index].avatar;
        idPlayer1 = waitingRoom[index].id;
      }
      if(waitingRoom[index].pseudo == players.moi){
        //console.log(index);
        waitingRoom[index].alreadyPlaying = true;
        pseudoPlayer2 = waitingRoom[index].pseudo;
        avatarPlayer2 = waitingRoom[index].avatar;
        idPlayer2 = waitingRoom[index].id;
      }
    }
  //Je notifie à mes deux joueurs que leur room est prête à débuter le jeu
  io.in(players.roomName).emit('roomReady', {Player1: pseudoPlayer1, Player1Avatar: avatarPlayer1, Player1Id: idPlayer1, Player2: pseudoPlayer2, Player2Avatar: avatarPlayer2, Player2Id: idPlayer2});
  // Je notifie à tout le monde que deux joueurs entrent dans une partie
  io.local.emit('alreadyInRoom', {Player1: idPlayer1, Player2: idPlayer2});

/* RECETTES A ENVOYER AUX JOUEURS DE LA ROOM */
  //Je lance une fonction random pour trouver 4 recettes et lancer le jeu
  //myArray est un tableau de 4 nombres aleatoires pour trouver des recettes différentes
  var myNumber = chooseRandomNumbers();
  //console.log(myNumber);
  //Je requête en base les informations de chaque recettes dans le tableau
    db.connect(URL, function(err){
      myDb = db.get().db('jeumulti')
      recipe = myDb.collection('recipe')
      recipe.find(
        {
   		     id:  myNumber
   	   },
        {
            id: 1, name: 1, ingredients: 1, _id: 0
        }
      ).toArray(function(err, data){
        if(err){
          throw err;
        } else {
          //data contient mon tableaux avec mon objet correspondant à la recette
          //console.log(data);
          io.in(players.roomName).emit('firstRecipe', {premiereRecette: data[0].name, idrecette: data[0].id});
        }
      });//fin toArray
      db.close();
    })//fin db connect
  });//Fin joinRoom

////////// RECEPTION DES PREMIERES RECETTES !!!Laisser absolument en dehors du joinRoom //////////
    socket.on('formulaire', function(message){
      //console.log(message);
      var score;
      db.connect(URL, function(err){
        myDb = db.get().db('jeumulti')
        recipe = myDb.collection('recipe')
        recipe.find({
          id: message.idR,
        },{
          "ingredients": 1, "name": 1, "_id": 0, "id": 1
        }).toArray(function(err, data){
          if(err){
            throw err;
          }else{
            //console.log(data[0].ingredients);
            score = getRightAnswers(message.reponses, data[0].ingredients)
            //console.log(score);
            socket.emit('myScore', {pseudo: message.pseudo, id: message.id, score: score})
            io.in(message.room).emit('matchedIngredients', {pseudo: message.pseudo, id: message.id, score: score})
          }
        })//fin toArray
        db.close();
      })//fin connect
    });//fin socket formulaire

////////// UPDATE DES SCORES //////////
    socket.on('updateMyScore', function(score){
      //console.log(score);
      db.connect(URL, function(err){
        myDb = db.get().db('jeumulti')
        players = myDb.collection('players')
        players.updateOne(
          {pseudo : score.pseudo},
          {
            $inc: {score: score.score}
          }
        )
        db.close();
      })//fin db connect
      //Actualisation des scores sur la page des joueurs connectés
      setTimeout(function() {
        db.connect(URL, function(err){
          myDb = db.get().db('jeumulti')
          players = myDb.collection('players')
          players.find({
          }, {
            _id: 0, pseudo: 1, score: 1
          }).limit(15).sort({score: -1, pseudo: 1}).toArray(function(err, data){
            if(err){
              throw err;
            } else {
              io.local.emit('newHighScores', {data})
            }
          })//fin toArray
          db.close();
        })//fin connect
      }, 3000)
    })//fin updateMyScore

////////// FIN DU JEU A LA FIN DU CHRONO //////////
  socket.on('endGame', function(whatDoYouWant){
    //console.log(whatDoYouWant);
    io.in(whatDoYouWant.room).emit('andTheWinnerIs', 'bravo !');
  })//fin du jeu

////////// JE DECONNECTE LE JOUEUR QUI N'EST PAS PROPRIETAIRE DE LA ROOM //////////
  socket.on('wannaLeaveThisRoom', function(roomToLeave){
    socket.leave(roomToLeave.roomName);
    io.sockets.to(roomToLeave.roomName).emit('testdeco', 'une déconnexion');
  })//fin wannaLeaveThisRoom

////////// QUAND LES JOEURS NE SONT PLUS ENGAGES DANS UNE PARTIE //////////
  socket.on('giveTheButtonBack', function(whoWantsButton){
    //console.log(whoWantsButton);
    //On reset la propriété alreadyPlaying à false pour envoyer les boutons aux joueurs
    for(index in waitingRoom){
      if(waitingRoom[index].id == whoWantsButton.idOwner){
        //console.log(index);
        waitingRoom[index].alreadyPlaying = false;
      }
      if(waitingRoom[index].id == whoWantsButton.idOpponent){
        //console.log(index);
        waitingRoom[index].alreadyPlaying = false;
      }
    }
    io.local.emit('backToTheWaitingRoom', {player1: whoWantsButton.idOwner, player2: whoWantsButton.idOpponent})
  })//fin giveTheButtonBack

////////// QUAND UN JOUEUR QUITTE LE JEU EN FERMANT SON NAVIGATEUR, JE LE RETIRE DU TABLEAU //////////
//loop sur le tableau des joueurs pour trouver la personne qui s'est déconnectée et la retirer.
  socket.on('disconnect', function(){
    for( let i=0 ; i<waitingRoom.length ; i++){
      if(waitingRoom[i].id == socket.id){
        waitingRoom.splice(i, 1)
      }
    }
//J'envoie à l'ensemble des personnes présentes l'évènement de déconnection d'un joueur et côté client je le supprime
    io.local.emit('somebodyIsGone', socket.id);
    //console.log(waitingRoom);
  })

});//fin connexion générale socket io

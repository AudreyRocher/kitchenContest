(function (window, io){
  $(document).ready(function(){
    var socket = io.connect('http://www.audreyrocher.com/');

////////// FONCTIONS USUELLES POUR LE JEU //////////
// fonction pour écrire les réponses saisies par les joueurs dans le formulaire de jeu

////////// VARIABLES GLOBALES //////////
var room;
var monPseudo;
var monId;
var monScore;
var myScoreHere = 0;
////////// FONCTION POUR AJOUTER UN CHRONO DANS LA PARTIE //////////
function countdown() {
  var timeLeft;
  var time;
  timeLeft = document.getElementById('countdown').innerHTML;
  timeLeft = parseInt(timeLeft, 10);
  if(timeLeft == 2){
    $('#cookingHall').hide();
  }
  if (timeLeft == 1) {
    time = document.getElementById('countdown');
    time.innerHTML = "time's up !"
    socket.emit('endGame', {room: room, message: 'C\'est fini'});
    return;
  }
  timeLeft--;
  time = document.getElementById('countdown');
  time.innerHTML = timeLeft;
  timeOut = setTimeout(countdown, 1000);
}

////////// FONCTION POUR EVITER LES CARACTERES SPECIAUX //////////
  function noStrangeChars(chars) {
  // Caractères autorisés
  var regex = new RegExp("[a-z0-9]", "i");
  var accept;
  for (let x = 0; x < chars.value.length; x++) {
      accept = regex.test(chars.value.charAt(x));
      if (accept == false) {
          chars.value = chars.value.substr(0, x) + chars.value.substr(x + 1, chars.value.length - x + 1); x--;
      }
  }
  }

////////// JE CACHE LA SALLE DE JEU QUAND LE JOUEUR SE CONNECTE //////////
$('#kitchen').hide();
$('#waiting').hide();

////////// JE SIGNALE AU SERVEUR QUE JE VIENS DE ME CONNECTER SUR LA PAGE DU JEU //////////
  socket.emit('readyToSeeTheWaitingRoom', true);

////////// JE SOUHAITE RECUPERER LE TABLEAU DES SCORES //////////
  socket.emit('giveMeTheHighestScore', true);

////////// JE RECUPERE LES SCORES DEPUIS LA BASE //////////
  socket.on('hereAreTheHighestScores', function(scores){
    //console.log(scores.data[0].pseudo);
    for(let i=0 ; i<scores.data.length ; i++){
      $('#high').append('<li>' + scores.data[i].pseudo + ' ' + scores.data[i].score + '</li>');
    }
  });

////////// MISE A JOUR DES SCORES PENDANT LES PARTIES //////////
  socket.on('newHighScores', function(scores){
    //console.log(scores);
    $('#high').empty();
    for(let i=0 ; i<scores.data.length ; i++){
      $('#high').append('<li>' + scores.data[i].pseudo + ' ' + scores.data[i].score + '</li>');
    }
  })

////////// JE RECUPERE LES PRECEDENTS JOUEURS CONNECTES AVANT DE M'INSCRIRE //////////
  socket.on('envoyerLaWaitingRoom', function(waitingRoom){
    //console.log(waitingRoom);
    for(let i=0 ; i<waitingRoom.length ; i++){
      if(waitingRoom[i].alreadyPlaying == true){
        $('#hall').append('<div id="'+waitingRoom[i].id+'" class="ciblage"><p class="name"><span>'+waitingRoom[i].pseudo+'</span></p><img class="avatars" src="'+waitingRoom[i].avatar+'"/></div>');
      }else{
        $('#hall').append('<div id="'+waitingRoom[i].id+'" class="ciblage"><p class="name"><span>'+waitingRoom[i].pseudo+'</span></p><img class="avatars" src="'+waitingRoom[i].avatar+'"/><button class="but">Affronter</button></div>');
      }
    }
  });

////////// FORMULAIRE D'INSCRIPTION POUR JOUER AU JEU //////////
  $('#inscription').on('submit', function(event){
    event.preventDefault();//Stoppe le comportement normal de la soumission du formulaire
    socket.emit('joinWaitingRoom', {pseudo: $('#pseudo').val(), password: $('#password').val()});
  });

////////// FORMULAIRE DE CONNEXION POUR JOUER AU JEU //////////
  $('#connexion').on('submit', function(event){
    event.preventDefault();
    //console.log($('#pseudoC').val());
    //console.log($('#passwordC').val());
    socket.emit('login', {pseudo: $('#pseudoC').val(), password: $('#passwordC').val()});
  });
////////// ERREUR SI LE PSEUDO EST DEJA PRIS //////////
  socket.on('pseudo invalide', function(message){
    $('#begin').after('<p class="wrong">' + message + '</p>');
    //console.log(message);
  });

////////// DECONNECTION D'UN JOUEUR //////////
  socket.on('somebodyIsGone', function(guilty){
    //console.log(guilty);
    $('#' + guilty).remove();
  });

////////// TEST MESSAGE DE LA ROOM CREE POUR CHAQUE JOUEUR //////////
  socket.on('test', function(message){
    //console.log(message);
  });

var me;
var myAvatar;
var myId;
////////// NOUVEAU JOUEUR DANS LE HALL //////////
  socket.on('newPlayerForCooking', function(player){
    //console.log(player);
    //Evènements visibles pour tous les joueurs, j'attribue une div avec les infos nécessaires
    $('#hall').append('<div id="'+player.id+'" class="ciblage"><p class="name"><span>'+player.pseudo+'</span></p><img class="avatars" src="'+player.avatar+'"/><button class="but">Affronter</button></div>');
    //condition pour que les éléments ne disparaissent que pour moi
    if(player.connected){
      me = player.pseudo;
      myAvatar = player.avatar;
      myId = player.id;
      $('#register').fadeOut(); //Je retire l'affichage du menu inscription/connexion
      $('#waiting').show(); //J'affiche le lobby ou chaque joueur se connecte
      $('footer').fadeOut();//Je retire les crédits, dans le jeu on s'en fiche
      $('#' + player.id).addClass("joueursLobby");
      $('#'+ player.id).children('.but').hide();
    }
  });

  /// Mon event perso///
  socket.on('justePourMoi', function(myData){
    //console.log(myData);
    monPseudo = myData.pseudo;
    monId = myData.id;
    monScore = myData.score;
  });

////////// COMMENCER UNE PARTIE AVEC UN JOUEUR //////////
  $('#hall').on('click', '.ciblage button', function(){
    room = $(this).siblings('p.name').children('span').html();
    //console.log(room);
    var avatarP1 = $(this).siblings('img').attr('src');
    var idPlayer1 = $(this).parent().attr('id');
    socket.emit('joinRoom', {roomName: room, roomAvatar: avatarP1, roomId: idPlayer1, moi: me, monAvatar: myAvatar, monId: myId});
  });

////////// JE RETIRE LES BOUTONS DES JOUEURS ENGAGES DANS UNE PARTIE //////////
  socket.on('alreadyInRoom', function(remove){
    //console.log(remove);
    $('#' + remove.Player1).children('button').hide();
    $('#' + remove.Player2).children('button').hide();
  });

var roomOwner; //détermine le joueur propriétaire de la room
var idOwner;//détermine l'id du joueur propriétaire de la room
var opponent;
var idOpponent;
////////// JE DEVOILE LA ROOM AUX JOUEURS QUI S'AFFRONTENT //////////
socket.on('roomReady', function(message){
  //console.log(message);
  room = message.Player1;
  roomOwner = message.Player1;
  var ownerAvatar = message.Player1Avatar;
  idOwner = message.Player1Id;
  opponent = message.Player2;
  var opponentAvatar = message.Player2Avatar;
  idOpponent = message.Player2Id;
  //Je masque la waiting room pour les joueurs engagés dans une partie
  $('#waiting').fadeOut();
  //Je fais apparaitre l'espace de jeu pour les deux joueurs
  $('#kitchen').show();
  //Affichage des pseudos et avatars des joueurs engagés dans la partie
  $('#kitchenContest').append('<div id="a'+idOwner+'" class="inGame"><p>'+ roomOwner + '</p><img class="avatars" src="'+ ownerAvatar +'"/><p id="s'+idOwner+'" class="score">0</p></div>');
  $('#kitchenContest').append('<div id="a'+idOpponent+'" class="inGame"><p>'+ opponent + '</p><img class="avatars" src="'+ opponentAvatar +'"/><p id="s'+idOpponent+'" class="score">0</p></div>');

});

////////// LES PLAYERS ENGAGES DANS UNE ROOM RECOIVENT LES RECETTES //////////
var idrecette
socket.on('firstRecipe', function(recipe){
  //console.log(monPseudo);
  //console.log(monId);
  //console.log(recipe);
  //console.log(room);
  //console.log(roomOwner);
  //console.log(idOwner);
  //console.log(opponent);
  //console.log(idOpponent);
  idrecette = recipe.idrecette;
  //console.log(me);
  $('#kitchenContest').after('<div id="orga"><p class="recipe">'+ recipe.premiereRecette + '</p><div id="countdown">40</div></div>');
//Je lance le premier chrono pour la recette {reponses, idR: idrecette, room: room, pseudo: monPseudo, id: monId}
  countdown();//a la fin du chrono j'envoie un message au serveur pour avoir une nouvelle recette
})//fin socket on firstRecipe

$('#cookingBook').on('submit', function(event){
  event.preventDefault();
  var reponses = [$('#a').val().toLowerCase(), $('#b').val().toLowerCase(), $('#c').val().toLowerCase(),
    $('#d').val().toLowerCase(), $('#e').val().toLowerCase(), $('#f').val().toLowerCase(),
    $('#g').val().toLowerCase(), $('#h').val().toLowerCase(), $('#i').val().toLowerCase(),
    $('#j').val().toLowerCase(), $('#k').val().toLowerCase(), $('#l').val().toLowerCase()];
    //console.log(reponses);
  socket.emit('formulaire', {reponses, idR: idrecette, room: room, pseudo: monPseudo, id: monId});
    $('#cookingHall').hide();
});

////////// NOMBRE INGREDIENTS OK //////////
socket.on('matchedIngredients', function(howMany){
  //console.log(howMany);
  $('#s' + howMany.id).text(howMany.score);
});

////////// UPDATE DES SCORES //////////
socket.on('myScore', function(wow){
  //console.log(wow);
  myScoreHere = wow.score;
  //console.log(myScoreHere);
  socket.emit('updateMyScore', {pseudo: wow.pseudo, score: wow.score});
});

////////// AFFICHAGE DU GAGNANT //////////
  socket.on('andTheWinnerIs', function(end){
    //console.log(end);
    socket.emit('giveTheButtonBack', {roomOwner: roomOwner, idOwner: idOwner, opponent: opponent, idOpponent: idOpponent});
    setTimeout(function(){
      if(monId == idOpponent){
      //console.log(opponent);
      //console.log(parseFloat($('#s' + idOwner).text()));
      if(myScoreHere > parseFloat($('#s' + idOwner).text())){
        //console.log(opponent + ' à gagné cette partie !');
        $('.recipe').html(opponent + ' à gagné cette partie !');
        socket.emit('wannaLeaveThisRoom', {roomName: room});
      }
      if(myScoreHere < parseFloat($('#s' + idOwner).text())){
        //console.log(roomOwner + ' à gagné cette partie');
        $('.recipe').html(roomOwner + ' à gagné cette partie !');
        socket.emit('wannaLeaveThisRoom', {roomName: room});
      }
      if(myScoreHere == parseFloat($('#s' + idOwner).text())){
        //console.log('Egalité !');
        $('.recipe').html('Egalité !');
        socket.emit('wannaLeaveThisRoom', {roomName: room});
      }
    }else{
      //console.log(roomOwner);
      if(monId == idOwner){
        if(myScoreHere > parseFloat($('#s' + idOpponent).text())){
          //console.log(roomOwner + 'à gagné cette partie !');
          $('.recipe').html(roomOwner + ' à gagné cette partie !');
        }
        if(myScoreHere < parseFloat($('#s' + idOpponent).text())){
          //console.log(opponent + 'à gagné cette partie !');
          $('.recipe').html(opponent + ' à gagné cette partie !');
        }
        if(myScoreHere == parseFloat($('#s' + idOpponent).text())){
          //console.log('égalité !');
          $('.recipe').html('Egalité !');
        }
      }
    }
  }, 1000);
  setTimeout(function(){
    $('#kitchen').hide();
    $('#waiting').show();
  }, 3000);
  })//fin socket andTheWinnerIs

  socket.on('testdeco', function(message){
    //console.log(message);
  })

////////// RETOUR DES BOUTONS //////////
  socket.on('backToTheWaitingRoom', function(players){
    //console.log(players);
    setTimeout(function(){
      $('#kitchenContest').empty();
      $('#orga').remove();
      $('#cookingHall').show();
      $('#cookingBook')[0].reset();
    }, 5000);
    $('#' + players.player1).children('button').show();
    $('#' + players.player2).children('button').show();
    if(monId == players.player1){
      $('#' + players.player1).children('button').hide();
    }
    if(monId == players.player2){
      $('#' + players.player2).children('button').hide();
    }
  });
})//fin ready
})(window, io);

// https://app.roll20.net/forum/post/5440447/simple-question-listing-cards-in-player-hands-and-on-map/?pagenum=1
//
// usage: !deck-state <Deck Name>
//
// lists cards in hands in alphabetical order
// good for checking deck importing/building results
// deal the whole deck into the gm's hand and then count each type of card
//
// Trick from Aaron to fix "Syntax Error: Unexpected Identifier" - put a ";" at top of script
// The API Server concatenates all the scripts together, which can lead to code that isn't
// correct when a programmer relies on automatic semicolon insertion.
;
(function(){
    "use strict";
    const 
        esRE = function (s) {
          var escapeForRegexp = /(\\|\/|\[|\]|\(|\)|\{|\}|\?|\+|\*|\||\.|\^|\$)/g;
          return s.replace(escapeForRegexp,"\\$1");
        },

        HE = (function(){
          var entities={
                  //' ' : '&'+'nbsp'+';',
                  '<' : '&'+'lt'+';',
                  '>' : '&'+'gt'+';',
                  "'" : '&'+'#39'+';',
                  '@' : '&'+'#64'+';',
                  '{' : '&'+'#123'+';',
                  '|' : '&'+'#124'+';',
                  '}' : '&'+'#125'+';',
                  '[' : '&'+'#91'+';',
                  ']' : '&'+'#93'+';',
                  '"' : '&'+'quot'+';'
              },
              re=new RegExp('('+_.map(_.keys(entities),esRE).join('|')+')','g');
          return function(s){
            return s.replace(re, function(c){ return entities[c] || c; });
          };
        }()),
        ch = function (c) {
            var entities = {
                '<' : 'lt',
                '>' : 'gt',
                "'" : '#39',
                '@' : '#64',
                '{' : '#123',
                '|' : '#124',
                '}' : '#125',
                '[' : '#91',
                ']' : '#93',
                '"' : 'quot',
                '-' : 'mdash',
                ' ' : 'nbsp'
            };


            if(_.has(entities,c) ){
                return ('&'+entities[c]+';');
            }
            return '';
        },
        
        keyFormat = (s)=>s.toLowerCase().replace(/[^a-z0-9]/,''),
        showHelp = function(who){
            sendChat('',`/w "${who}" `+
            `<div>`+
                `<div>`+
                    `<code>!deck-state ${ch('<')}Deck name${ch('>')}</code>`+
                `</div>`+
                `<h4>Deck Name</h4>`+
                `<p>Wherever you specify a deck name, you can use the minimal matching part of the name.  Case is ignored, as are spaces and any punctuation.  ${ch('"')}Bob - the - builder!${ch('"')} would be matched by ${ch('"')}bob${ch('"')} or ${ch('"')}thebui${ch('"')} or a similar substring.</p>`+
            `</div>`
            );
        },
        
        getDecks = function(name){
            let deckKey=keyFormat(name||'');


            return deckKey ?
                _.filter(findObjs({ type: 'deck' }), (d)=> -1 !== keyFormat(d.get('name')).indexOf(deckKey)) :
                [];
        },
        showDeckOptions = function(who,msg,decks,deckName){
            let notFound = (decks.length ? '' : `<div style="color:red;font-weight:bold;">No deck found for <code>${deckName}</code></div>`),
                deckOpt = (decks.length ? decks : findObjs({type:'deck'}));
            sendChat('',`/w "${who}" `+
                `<div>`+
                    notFound+
                    `<div><div>Possible options:</div><ul>`+
                        _.map(deckOpt,(d)=>{
                            return `<li><a href="!deck-state ${HE(d.get('name'))}">${d.get('name')}</a></li>`;
                        }).join('')+
                    `</ul></div>`+
                `</div>`
            );
            
        },

        getLookup = (obj) => _.reduce(findObjs(obj),(m,o)=>{
            m[o.id]=o;
            return m;
        },{}),

        deckState = function(deck){
            // get cards 
            let cards = getLookup({
                type: 'card',
                deckid: deck.id
            });
            let hands = getLookup({
                type: 'hand'
            });
            let players = getLookup({
                type: 'player'
            });
            let pages = getLookup({
                type: 'page'
            });
            let remaining=_.keys(cards);

            // for each player, which cards do they have
            // map of [playerid] -> array of [card ids]
            let inHand = _.reduce(hands,(m,h)=>{
                let cids = _.intersection(h.get('currentHand').split(/,/),remaining);
                if(cids.length){
                    m[h.get('parentid')]=_.map(cids,(id)=>cards[id].get('name'));
                    remaining=_.difference(remaining,cids);
                }
                return m;
            },{});

            // for each played card, what map is it on
            // map of [pageid] -> array of [card ids]
            let played = _.chain(findObjs({
                    type: 'graphic',
                    subtype: 'card'
                }))
                .filter((c)=>_.contains(remaining,c.get('cardid')))
                .reduce((m,c)=>{
                    let pageid=c.get('pageid');
                    m[pageid] = (m[pageid]||[]);
                    m[pageid].push(cards[c.get('cardid')].get('name'));
                    return m;
                },{})
                .value();
            remaining = _.map(remaining,(id)=>cards[id].get('name'));

            const cf = (t) =>`<span style="display: inline-block;border:1px solid #ccc;border-radius:5px;background-color:white;padding:.1em .5em;">${t}</span>`;

            return `<div style="border: 1px solid #666; border-radius: 5px; padding: .25em; background-color: #efefff;">`+
                `<div style="border-bottom: 1px solid #666;font-size: 1.2em;font-weight: bold;">`+
                    `Deck ${cf(deck.get('name'))} has <b>${remaining.length}/${_.keys(cards).length}</b> cards.`+
                `</div>`+
                `<div>`+
                    `<div style="font-weight: bold;">${_.keys(played).length} table${_.keys(played).length===1 ?' has':'s have'} cards:</div>`+
                    `<div><ul>${_.map(played,(cs,pid)=>`<li><b>${pages[pid].get('name')}</b><ul>${_.map(cs.sort(),(c)=>`<li>${cf(c)}</li>`).join('')}</ul></li>`).join('')}</ul></div>`+
                    `<div></div>`+
                `</div>`+
                `<div>`+
                    `<div style="font-weight: bold;">${_.keys(inHand).length} player${_.keys(inHand).length===1 ?' has' :'s have'} cards:</div>`+
                    `<div><ul>${_.map(inHand,(cs,pid)=>`<li><b>${(players[pid]||{get:()=>'[DELETED]'}).get('displayname')}</b><ul>${_.map(cs.sort(),(c)=>`<li>${cf(c)}</li>`).join('')}</ul></li>`).join('')}</ul></div>`+
                    `<div></div>`+
                `</div>`+
            `</div>`;     
        };

    on('ready',function(){
        
        on('chat:message',function(msg){
            if(msg.type !== 'api' || !playerIsGM(msg.playerid)){
                return;
            }
            if(msg.content.match(/^!deck-state/)){
                let who=(getObj('player',msg.playerid)||{get:()=>'API'}).get('_displayname'),
                    deckname = msg.content.replace(/^!deck-state\s*/,''),
                    decks = getDecks(deckname);

                if(!deckname.length){
                    showHelp(who);
                    return;
                }
                if(1 !== decks.length){
                    showDeckOptions(who,msg.content,decks,deckname);
                    return;
                }

                // show
                _.each(decks, (d)=>{
                    sendChat('',`/w "${who}" ${deckState(d)}`);
                }); 
            }
        });
    });
})();

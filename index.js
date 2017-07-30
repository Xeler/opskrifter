var dbInfo = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'ops'
}

//De forskellige keys i vores 'data' array:
var dataKey = ["amount", "unit", "type"];


var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io')(server);
var mysql = require("mysql");

var con = mysql.createConnection(dbInfo);


con.connect(function (error) {
   if(error) console.log(error.stack);
});;

app.use(express.static(__dirname + '/public'));

server.listen(3000, function () {
});

io.on('connection', function(socket) {
        socket.on("new req", function(id) {
        //parametere for vores GET request
        var options = {
            host: 'www.dk-kogebogen.dk',
            path: '/opskrifter/visopskrift.php?id=' + id
        };
        //http.get sender vores anmodning:
        var req = http.get(options, function(res) {
            cont = [];
            res.on('data', function(chunk) {
                cont.push(chunk); //Når http sender en bid data tilbage, tilføjes dette til vores 'cont' array
            }).on("end", function() {
                cont = Buffer.concat(cont).toString(); //Når hele GET requesten er færdiggjort, 
                /*  Funktionen evalData(body) er specifikt udarbejdet til at behandle
                 *  HTML koden fra vores GET request. Den returnerer herefter et array
                 *  med følgende opskriftens informationer
                 */
                data = evalData(cont);
                
                //Opret en opskrift i databasen med tilhørende ID og navn:
                con.query("INSERT INTO opskrifter(id, navn) VALUES(?, ?)", [id, data["name"]], function(error, results, fields) {
                    if(error) {
                        throw error;
                    }
                });
                //For hver en række i vores opskrift, indsættes den som ingrediens i databasen:
                for(i=0; i<data[dataKey[0]].length; i++) {
                    con.query("INSERT INTO ingredienser(id, amount, unit, type) VALUES(?, ?, ?, ?)", [id, data[dataKey[0]][i], data[dataKey[1]][i], data[dataKey[2]][i]], function(error, results, fields) {
                        if(error) {
                            throw error;
                        }
                    }); 
                }
                //Opskriften er indsat, så vi returnerer 'success' til klienten:
                socket.emit("success");
            })
        });
    });
    
    
    
    
    
    
    socket.on("search", function(arr, page) {
        var recipes = [];
        counter = 0;
        if(!page)
            page = 1;
        
        for(ingr of arr) {
            
            con.query("SELECT id, type FROM ingredienser WHERE type LIKE ? GROUP BY id, type", ["%"+ingr+"%"], function(error, results, fields) {
                    
                    counter++;
                    if(error) {
                        throw error;
                    }
                    for(row of results) {
                        if(!recipes[row.id]) {                    
                            recipes[row.id] = [];
                            recipes[row.id]["id"] = (row.id);
                        }
                        recipes[row.id].push(row.type);
                        //console.log(recipes[row.id]);
                    }

                    
                    if(counter===(arr.length)) {
                        
                        //Dette er sidste ingrediens i listen, så vi kan nu arbejde videre med dataen:
                        recipes.sort(function(a, b) { //sorterer vores array i nedadgående rækkefølge
                            return b.length - a.length;
                        });
                        var temp = [];
                        for(i=0; i<recipes.length; i++) {
                            if(recipes[i])
                                temp.push(recipes[i]);
                        }
                        recipes = temp;
                        //Recipes er nu sorteret i et array, med flest igredienser øverst.
                        //Vi begrænser så antallet til 25, afhængtigt af hvilken side brugeren
                        //ønsker at kigge på
                        recipes.splice(0, (page-1)*25);
                        recipes.length = 25;
                        evalRecipes(recipes);
                    }
                });
       }
    });
});



var dataKey = ["amount", "unit", "type"];
function evalData(body) {
    //Inatialiser et nyt array, med 
    var data = new Array();
    data[dataKey[0]] = new Array();
    data[dataKey[1]] = new Array();
    data[dataKey[2]] = new Array();

    //Find navn på opskriften:
    var startPos = body.indexOf('itemprop="name"'); //Navn er i et html tag med denne attribut
    startPos = body.indexOf("<center", startPos); //Det er centeret, så det skal også fjernes
    startPos = body.indexOf(">", startPos)+1;
    var endPos = body.indexOf("</", startPos);

    data["name"] = body.substring(startPos, endPos).trim(); //Desuden er der whitespaces som trimmes

    //Find start position for søgning i opskriften:
    startPos = body.indexOf("Ingredienser:");
    body = body.substr(startPos);
    startPos = body.indexOf("<table")
    endPos = body.indexOf("</table", startPos);
    body = body.substring(startPos, endPos); //Vi fjerner al overflødig data som ikke er i denne tabel

    var rows = (body.match(/\<tr/g) || []).length; //antal <tr elementer i koden
    for(i=0; i<rows; i++) { //For hver række i tabellen
        for(n = 0; n<dataKey.length; n++) { //For hver kolonne i tabellen
            body = body.substr(body.indexOf("<td"));;
            startPos = body.indexOf(">")+1; //Hvor første <td slutter
            endPos = body.indexOf("</td");
            
            val = body.substring(startPos, endPos).trim(); //Find info imelelm <td></td> tags
            if(val==="" && n===0) {
                break; //Rækken indeholdte ikke en mængde i opskriften, så den forkastes:
            }
            if(val.indexOf(">")!=-1) {
                //Nogle data kan have mulighed for at have et link i stedet for ren tekst, så det fjerner vi:
                val = val.substring(val.indexOf(">")+1, val.indexOf("<", val.indexOf(">")+1)).trim();
            }
            if(val.indexOf("&")!=-1) { //&nbsp; -.-
                val = val.substr(val.indexOf(";")+1);
            }

            //En værdi er fundet, og den tilføjes til vores data-array:
            data[dataKey[n]].push(val);
            body = body.substr(endPos); //Vi fjerner dette element fra koden, så det ikke indgår i næste trin i lykken
        }
        //Samme tilgang som at fjerne vores forrige kollonne, nu er det blot en hel række.
        body = body.substr(body.indexOf("</tr"));
    }
    //Data arrayet returneres til indsætning i databasen
    return data;
}



function evalRecipes(arr) {
    for(i in arr) {
        arr[i]["o"] = []; //o for owns = ejer i forvejen
        arr[i]["n"] = []; //n for needs = mangler at købe
        
        for(n in arr[i]) {
            if(!isNaN(n)) {
                console.log(arr[n]);
                arr[i]["o"].push(arr[i][n]);
                
            }
        }

        con.query("SELECT id, navn FROM opskrifter WHERE id=?", [arr[i]["id"]], function(error, results, fields) {
            for(i in arr) {
                   if(arr[i]["id"]==results[0].id)
                    var key = i;
            }
            arr[key]["navn"] = results[0].navn;
            

            if(arr[key]["ready"])
                io.emit("recipe found", arr[key]["id"], arr[key]["navn"], arr[key]["o"], arr[key]["n"])
            else
                arr[key]["ready"] = true;
        });

        con.query("SELECT id, type FROM ingredienser WHERE id=?", [arr[i]["id"]], function(error, results, fields) {        
            for(i in arr) {
                if(arr[i]["id"]==results[0].id)
                    var key = i;
            }
            for(row of results) {
                var owns = false;
                for(o of arr[key]["o"]) {
                    if(row.type==o)
                        owns = true;
                }
                if(!owns)
                    arr[key]["n"].push(row.type);
            }
            //console.log(arr[key]["navn"]);
            if(arr[key]["ready"])
                io.emit("recipe found", arr[key]["id"], arr[key]["navn"], arr[key]["o"], arr[key]["n"])
            else
                arr[key]["ready"] = true;
            
            console.log(arr[key]["navn"])
        });
    }
}
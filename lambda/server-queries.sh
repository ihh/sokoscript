# https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar

aws dynamodb scan --table-name soko-clocks --endpoint-url http://localhost:8000 
curl -H 'Content-Type: application/json' http://localhost:3000/boards

curl -X POST -H 'Content-Type: application/json' -d '{"boardSize":64}' http://localhost:3000/boards
aws dynamodb scan --table-name soko-clocks --endpoint-url http://localhost:8000 
curl -H 'Content-Type: application/json' http://localhost:3000/boards

curl -X DELETE -H 'Content-Type: application/json' http://localhost:3000/boards/XXXXX

# post move with current time
node -e 'd=Date.now();cmd="curl -X POST -H '"'"'Content-Type: application/json'"'"' -d '"'"'{\"time\":"+d+"}'"'"' "+process.argv[1];console.log(cmd);out=require("child_process").execSync(cmd).toString();console.log(out)' http://localhost:3000/boards/XXXXX/moves

# post block update with empty move list
node -e 'ml=[];import(process.env.HOME+"/sokoscript/src/md5.js").then((md5)=>{h=md5.hexMD5(JSON.stringify(ml));previousBlockHash="d9e96e8d99d83ff3527227502f683d36";boardState=null;cmd="curl -X POST -H '"'"'Content-Type: application/json'"'"' -d '"'"'{\"time\":"+d+"}'"'"' "+process.argv[1];console.log(cmd);out=require("child_process").execSync(cmd).toString();console.log(out)' http://localhost:3000/boards/XXXXX/moves
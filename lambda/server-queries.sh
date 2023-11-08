aws dynamodb scan --table-name soko-clocks --endpoint-url http://localhost:8000 
curl -H 'Content-Type: application/json' http://localhost:3000/boards

curl -X POST -H 'Content-Type: application/json' -d '{"boardSize":64}' http://localhost:3000/boards
aws dynamodb scan --table-name soko-clocks --endpoint-url http://localhost:8000 
curl -H 'Content-Type: application/json' http://localhost:3000/boards

curl -X DELETE -H 'Content-Type: application/json' http://localhost:3000/boards/XXXXX

node -e 'd=Date.now();cmd="curl -X POST -H '"'"'Content-Type: application/json'"'"' -d '"'"'{\"time\":"+d+"}'"'"' "+process.argv[1];console.log(cmd);out=require("child_process").execSync(cmd).toString();console.log(out)' http://localhost:3000/boards/XXXXX/moves
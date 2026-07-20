## Para verificar si el socket io sigue levantado

lsof -i:4000

## Para matarlo

kill $(lsof -t -i:4000)

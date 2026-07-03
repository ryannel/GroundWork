# Data Flows

Every command is a single synchronous pass: parse → act on the store → print.

## Add

```
add "<title>"  ->  TaskStore.add(title)  ->  append record, assign next id, persist  ->  print "Added #<id>: <title>"
```

## List

```
list  ->  TaskStore.all()  ->  read every record in insertion order  ->  print one checkbox line per task
```

## Complete (milestone 2)

```
done <id>  ->  TaskStore.complete(id)  ->  flip done=True, persist  ->  print "Completed #<id>"
```

The store is the only stateful component; the CLI holds no state between
invocations. Persistence is read-modify-write of the whole JSON file each time —
correct and simple at this scale; no concurrency is in scope.

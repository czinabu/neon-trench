"use strict";
/* Explicit state machines: a named state, the states it may move to, and a short history.
   The catalogue of every machine in the game (these and the ones still kept as flags) is docs/state-machines.md.

   defineMachine(name, initial, states) -> machine
     states: {stateName: {to: [names it may move to], note: 'what the state means'}}
     machine.state      the current state
     machine.can(to)    is that move in the table?
     machine.go(to)     move. A move the table does not list is reported with console.error (the smoke test
                        fails on it) and still made, so a missing table row can never lock a player out.
     machine.log        the last moves, oldest first: {from, to, t} (t = performance.now())
   Every machine is also in MACHINES by name, so `MACHINES.run.state` and `MACHINES.run.log` answer
   "where is the game, and how did it get here" from the console or a test. */
const MACHINES={};
const MACHINE_LOG=40;   // moves kept per machine
function defineMachine(name,initial,states){
  const m={name,state:initial,states,log:[],
    can:to=>!!states[to]&&states[m.state].to.includes(to),
    go(to){
      if(!m.can(to))console.error('['+name+'] move not in the table: '+m.state+' -> '+to+' (js/machine.js, docs/state-machines.md)');
      if(to!==m.state){m.log.push({from:m.state,to,t:performance.now()});if(m.log.length>MACHINE_LOG)m.log.shift();}
      m.state=to;
    }};
  return MACHINES[name]=m;
}

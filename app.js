/* global require console process Promise module */

const express = require('express'),
  app = express();
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('data.db');

const MAX_ROWS = 24;

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function getFlight() {
  return getRandomInt(2000);
}

function getGate() {
  const t = ['A', 'B', 'C'][getRandomInt(2)];
  const g = getRandomInt(30);
  return `${t}${g}`;
}

function getTime(time) {
  let date = new Date(time);
  let hrs = date.getHours().toString().padStart(2, '0');
  let mins = date.getMinutes().toString().padStart(2, '0');

  return `${hrs}${mins}`;
}

function processCustomDepartures(customDepartures) {
  customDepartures.forEach(departure => {
    db.run(
      'insert into departure (place, scheduled_time, delay, airline, flight, gate) ' +
      'values ($place, $scheduled_time, $delay,' +
      '(ifnull($airline, (select name from airline order by random() limit 1))), $flight, $gate)',
      {
        $place: departure.place,
        $scheduled_time: departure.scheduled_time,
        $delay: departure.delay,
        $airline: departure.airline,
        $flight: departure.flight || getFlight(),
        $gate: departure.gate || getGate()
      },
      (err) => {
        if (err) {
          console.log(err)
        }
        db.run(
          'update custom_departure set processed = 1 where id = $id',
          {$id: departure.id}
        );
      }
    );
  });
}

function insertRandomDepartures(departuresNum, futurestTime, maxFuture) {
  for(let i = 0; i < departuresNum; i++) {
    let scheduledTime = futurestTime + (getRandomInt(maxFuture) * 60 * 1000);
    let delay = getRandomInt(10) > 7 ? getRandomInt(50) * 60 * 1000 : 0;

    db.run(
      'insert into departure (place, scheduled_time, delay, airline, flight, gate) ' +
      'values ((select name from place order by random() limit 1), $scheduled_time, $delay,' +
      '(select name from airline order by random() limit 1), $flight, $gate)',
      {
        $scheduled_time: scheduledTime,
        $delay: delay,
        $flight: getFlight(),
        $gate: getGate()
      }
    );
  }
}

// ========================================================================
// API

app.use('/api/departures', (req, res) => {
  db.serialize(() => {
    // Delete departures older than 15 minutes
    db.run(
      'delete from departure where scheduled_time < $now',
      {$now: (Date.now() - 900000)}
    );

    // Look up all departures to figure out how many departures to add,
    // either from the custom_departure table or randomizing.
    db.all(
      'select * from departure order by scheduled_time desc',
      (err, departures) => {

        let departuresToInsert = MAX_ROWS - departures.length;
        if (departuresToInsert > 0) {
          db.all(
            'select * from custom_departure where processed = 0 order by id asc limit $process_limit',
            {$process_limit: departuresToInsert},
            (err, customDepartures) => {
              db.serialize(() => {
                processCustomDepartures(customDepartures);

                let futurestTime = Math.floor(Date.now() / (60 * 1000)) * 60 * 1000;
                if (departures.length) {
                  futurestTime = departures[0].scheduled_time;
                }

                let maxFuture = 360; // 6 hours in minutes
                if (departuresToInsert - customDepartures.length < 12) {
                  maxFuture = 1440; // Need to generate a lot more departures, so randomize up to 24 hours in the future
                }
                insertRandomDepartures(departuresToInsert - customDepartures.length, futurestTime, maxFuture);
              });
            }
          );
        }
      }
    );

    // Return all departures in the response
    db.all(
      'select * from departure',
      (err, departures) => {
        let r = {
          data: []
        };

        departures.forEach(departure => {
          let remarks = departure.delay ? `Delayed ${departure.delay / (60 * 1000)}M` : '';
          let now = Date.now();
 
          if (
            now - departure.scheduled_time < 15 * 60 * 1000 &&
            now - departure.scheduled_time > 0
          ) { // within 15 minutes ago
            remarks = 'Departed';
          } else if (departure.scheduled_time - now < 15 * 60 * 1000) { // coming up within 15 minutes
            remarks = 'Boarding';
          }

          r.data.push({
            airline: departure.airline,
            flight: departure.flight,
            city: departure.place,
            gate: departure.gate,
            scheduled: getTime(departure.scheduled_time),
            scheduledEpoch: departure.scheduled_time,
            status: departure.delay ? 'B' : 'A',
            remarks: remarks
          });
        });

        res.json(r);
      }
    );
  });
});

// ========================================================================
// STATIC FILES
app.use('/', express.static('public'));

// ========================================================================
// WEB SERVER
const port = process.env.PORT || 8080;
app.listen(port);
console.log('split flap started on port ' + port);

/*

StreamBundle is a "bundle of streams": Bacon.js streams, two
for each Signal K (source, path) combination. You can get a stream
for the raw data with getBusForSourcePath and a stream where data
is debounced (200 ms) and some units converted with
getStreamForSourcePath.

All incoming Signal K deltas should be passed in via handleDelta.

In addition to the individual streams StreamBundle provides a
stream that contains notifications of new (source, path)
combinations appearing in the incoming data. The data in
that stream contains {sourceId, path, key, stream} objects.
InstrumentPanel discovers new data items by listening to this
stream.

Key is a 'standard' single string representation  of source id
and path produced with signalkSchema.keyForSourceIdPath.

*/
import Bacon from 'baconjs';

function getSourceId(source) {
  if (!source) {
    return 'no_source';
  }
  if (source.src || source.pgn) {
    return source.label +
      (source.src ? '.' + source.src : '') +
      (source.instance ? '.' + source.instance : '');
  }
  if (typeof source === 'object') {
    return source.label + (source.talker ? '.' + source.talker : '.XX');
  }
  //source data is actually from $source, not source: {...}
  return source
}

function keyForSourceIdPath(sourceId, path) {
  return sourceId + "." + path;
}

export default function StreamBundle() {
  this.buses = {};
  this.streams = {};
  this.pathValues = new Bacon.Bus();
  this.allSources = new Bacon.Bus();
}

StreamBundle.prototype.handleDelta = function(delta, instrumentPanel) {
  var that = this;
  delta.updates && delta.updates.forEach(function(update) {
    var sourceId = getSourceId(update.source);
    update.values && update.values.forEach(function(pathValue) {
      if(!pathValue.value) pathValue.value = '-';
      if(pathValue.path) {
        that.push(sourceId, pathValue);
        try {
          if ((pathValue.path === 'environment.mode') && instrumentPanel.isColorSchemeSetBySKPATH()) {
            const nightOn = pathValue.value.toString() === 'night';
            if (instrumentPanel.getDarkMode() !== nightOn) {
              instrumentPanel.setDarkMode(! instrumentPanel.getDarkMode());
            }
          }
        } catch(error) {console.log(error)}
      }
    });
  });
}

StreamBundle.prototype.push = function(sourceId, pathValue) {
  pathValue.sourceId = sourceId;

  this.pathValues.push(pathValue);

  this.getBusForSourcePath(sourceId, pathValue.path).push(pathValue.value);

  var key = keyForSourceIdPath(sourceId, pathValue.path);
  this.allSources.push({
    sourceId: sourceId,
    path: pathValue.path,
    key: key,
    stream: this.getStreamForSourcePath(sourceId, pathValue.path)
  });
}

StreamBundle.prototype.getBusForSourcePath = function(sourceId, path) {
  var key = keyForSourceIdPath(sourceId, path);
  var result = this.buses[key];
  if(!result) {
    result = this.buses[key] = new Bacon.Bus();
  }
  return result;
}

StreamBundle.prototype.getStreamForSourcePath = function(sourceId, path) {
  var key = keyForSourceIdPath(sourceId, path);
  var result = this.streams[key];
  if(!result) {
    var bus = this.getBusForSourcePath(sourceId, path);
    result = bus.debounceImmediate(200);
    result = this.streams[key] = result.toProperty();
  }
  return result;
}

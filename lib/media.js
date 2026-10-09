/* ffmpeg/ffprobe helpers. The sync ones are used by the static build script;
   the async ones (with progress) are used by the admin upload pipeline so a
   long compression never blocks the web server. */
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');

function probeVideo(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', file,
  ], { encoding: 'utf8' });
  const data = JSON.parse(out);
  return {
    width: data.streams[0].width,
    height: data.streams[0].height,
    duration: Math.round(parseFloat(data.format.duration)),
  };
}

function ensurePoster(videoFile, posterFile) {
  if (fs.existsSync(posterFile)) return;
  execFileSync('ffmpeg', [
    '-y', '-ss', '1', '-i', videoFile,
    '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3',
    posterFile,
  ], { stdio: 'ignore' });
}

function runFfmpeg(args, { duration, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let buf = '';
    proc.stdout.on('data', chunk => {
      if (!onProgress || !duration) return;
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const m = line.match(/^out_time_(?:us|ms)=(\d+)/);
        if (m) onProgress(Math.min(100, Math.round((parseInt(m[1], 10) / 1e6 / duration) * 100)));
      }
    });
    proc.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
    proc.on('error', reject);
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error('ffmpeg failed: ' + stderr.trim().split('\n').pop()))));
  });
}

function compressVideo(input, output, duration, onProgress) {
  return runFfmpeg([
    '-y', '-i', input,
    '-c:v', 'libx264', '-crf', '28', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats', output,
  ], { duration, onProgress });
}

function extractAudio(video, output) {
  return runFfmpeg(['-y', '-i', video, '-vn', '-q:a', '9', output]);
}

function makePoster(video, output, duration) {
  const at = duration > 4 ? 2 : 0;
  return runFfmpeg(['-y', '-ss', String(at), '-i', video, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3', output]);
}

module.exports = { probeVideo, ensurePoster, compressVideo, extractAudio, makePoster };

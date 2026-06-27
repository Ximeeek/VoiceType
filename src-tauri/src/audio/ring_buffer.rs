pub const CHUNK_SAMPLES: usize = 1536; // 32ms at 48kHz (will become 512 at 16kHz)

pub struct RingBuffer {
    data: Vec<f32>,
    write_pos: usize,
    available: usize,
    capacity: usize,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            data: vec![0.0; capacity],
            write_pos: 0,
            available: 0,
            capacity,
        }
    }

    pub fn push_slice(&mut self, samples: &[f32]) {
        for &sample in samples {
            self.data[self.write_pos] = sample;
            self.write_pos = (self.write_pos + 1) % self.capacity;
            if self.available < self.capacity {
                self.available += 1;
            }
        }
    }

    pub fn drain_chunk(&mut self) -> Option<Vec<f32>> {
        if self.available >= CHUNK_SAMPLES {
            let mut chunk = Vec::with_capacity(CHUNK_SAMPLES);
            let mut read_pos = (self.write_pos + self.capacity - self.available) % self.capacity;
            
            for _ in 0..CHUNK_SAMPLES {
                chunk.push(self.data[read_pos]);
                read_pos = (read_pos + 1) % self.capacity;
            }
            
            self.available -= CHUNK_SAMPLES;
            Some(chunk)
        } else {
            None
        }
    }
}

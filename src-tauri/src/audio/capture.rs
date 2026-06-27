use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::mpsc::SyncSender;

#[derive(Debug, Clone, serde::Serialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
}

pub fn list_audio_devices() -> Vec<AudioDevice> {
    let host = cpal::default_host();
    let mut devices = Vec::new();
    
    if let Ok(input_devices) = host.input_devices() {
        for device in input_devices {
            if let Ok(name) = device.name() {
                devices.push(AudioDevice {
                    id: name.clone(),
                    name,
                });
            }
        }
    }
    
    devices
}

pub fn start_capture(
    device_name: &str,
    sender: SyncSender<Vec<f32>>,
) -> anyhow::Result<cpal::Stream> {
    let host = cpal::default_host();
    
    let device = if device_name == "default" {
        host.default_input_device().ok_or_else(|| anyhow::anyhow!("No default input device found"))?
    } else {
        host.input_devices()?
            .find(|x| x.name().map(|y| y == device_name).unwrap_or(false))
            .ok_or_else(|| anyhow::anyhow!("Device not found"))?
    };

    let supported_config = match device.default_input_config() {
        Ok(config) => config,
        Err(_) => {
            device.supported_input_configs()?
                .next()
                .ok_or_else(|| anyhow::anyhow!("No supported input configs"))?
                .with_max_sample_rate()
        }
    };
        
    let config = supported_config.config();
    let _sample_rate = config.sample_rate.0;
    let channels = config.channels;
    let sample_format = supported_config.sample_format();

    println!("[AUDIO] Starting capture on device: '{}', Format: {:?}, SR: {}, Channels: {}", 
        device.name().unwrap_or_else(|_| "unknown".into()), 
        sample_format, 
        config.sample_rate.0, 
        channels
    );

    use cpal::Sample;
    macro_rules! build_stream {
        ($type:ty) => {{
            device.build_input_stream(
                &config,
                move |data: &[$type], _: &_| {
                    let gain = 3.0; // Software boost for quiet microphones (like Discord's AGC)
                    let float_data: Vec<f32> = data.iter()
                        .map(|&x| (x.to_sample::<f32>() * gain).clamp(-1.0, 1.0))
                        .collect();
                    process_audio_data(&float_data, channels, &sender);
                },
                |err| eprintln!("An error occurred on the audio stream: {}", err),
                None,
            )?
        }};
    }

    let stream = match supported_config.sample_format() {
        cpal::SampleFormat::F32 => build_stream!(f32),
        cpal::SampleFormat::I16 => build_stream!(i16),
        cpal::SampleFormat::U16 => build_stream!(u16),
        cpal::SampleFormat::I32 => build_stream!(i32),
        cpal::SampleFormat::U32 => build_stream!(u32),
        cpal::SampleFormat::F64 => build_stream!(f64),
        cpal::SampleFormat::I8 => build_stream!(i8),
        cpal::SampleFormat::U8 => build_stream!(u8),
        f => return Err(anyhow::anyhow!("Unsupported sample format: {}", f)),
    };

    stream.play()?;

    Ok(stream)
}

fn process_audio_data(data: &[f32], channels: u16, sender: &SyncSender<Vec<f32>>) {
    if data.is_empty() { return; }

    let mono_data: Vec<f32> = if channels > 1 {
        data.chunks(channels as usize).map(|chunk| chunk[0]).collect()
    } else {
        data.to_vec()
    };

    if !mono_data.is_empty() {
        let _ = sender.try_send(mono_data);
    }
}

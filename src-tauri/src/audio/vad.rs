use ort::session::{Session, builder::GraphOptimizationLevel};
use ort::value::Tensor;

pub struct SileroVad {
    session: Session,
    state: Vec<f32>,
    sample_rate: i64,
}

impl SileroVad {
    pub fn new(model_path: &str) -> anyhow::Result<Self> {
        let session = Session::builder()
            .map_err(|e| anyhow::anyhow!("{}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level1)
            .map_err(|e| anyhow::anyhow!("{}", e))?
            .commit_from_file(model_path)
            .map_err(|e| anyhow::anyhow!("{}", e))?;
            
        Ok(Self {
            session,
            state: vec![0.0; 2 * 1 * 128], // [2, 1, 128]
            sample_rate: 16000,
        })
    }

    pub fn predict(&mut self, audio_chunk: &[f32]) -> anyhow::Result<f32> {
        if audio_chunk.len() != 512 {
            return Err(anyhow::anyhow!("Audio chunk must be exactly 512 samples"));
        }

        let input_val = Tensor::from_array(([1, 512], audio_chunk.to_vec())).map_err(|e| anyhow::anyhow!("{}", e))?;
        let sr_val = Tensor::from_array(ndarray::arr0(self.sample_rate)).map_err(|e| anyhow::anyhow!("{}", e))?;
        let state_val = Tensor::from_array(([2, 1, 128], self.state.clone())).map_err(|e| anyhow::anyhow!("{}", e))?;

        let inputs: Vec<(&str, ort::session::SessionInputValue<'_>)> = vec![
            ("input", input_val.into()),
            ("sr", sr_val.into()),
            ("state", state_val.into()),
        ];

        let outputs = self.session.run(inputs).map_err(|e| anyhow::anyhow!("{}", e))?;

        let speech_prob = outputs["output"].try_extract_tensor::<f32>().map_err(|e| anyhow::anyhow!("{}", e))?.1[0];
        let state_slice = outputs["stateN"].try_extract_tensor::<f32>().map_err(|e| anyhow::anyhow!("{}", e))?.1;
        self.state = state_slice.to_vec();

        Ok(speech_prob)
    }

    pub fn reset_states(&mut self) {
        self.state.fill(0.0);
    }
}

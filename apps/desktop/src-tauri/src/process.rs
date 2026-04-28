use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn background_command(program: &str) -> Command {
    let mut command = Command::new(program);
    configure_background_process(&mut command);
    command
}

fn configure_background_process(_command: &mut Command) {
    #[cfg(windows)]
    {
        _command.creation_flags(CREATE_NO_WINDOW);
    }
}

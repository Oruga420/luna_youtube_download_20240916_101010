import gradio as gr
from pytube import YouTube

def download_youtube_video_to_folder(video_id, folder_path):
    url = f'https://www.youtube.com/watch?v={video_id}'
    yt = YouTube(url)
    stream = yt.streams.get_highest_resolution()
    download_path = stream.download(output_path=folder_path)
    return f"Video downloaded at: {download_path}"

# Define the Gradio interface
interface = gr.Interface(
    fn=lambda video_id: download_youtube_video_to_folder(video_id, "where to save the video"),
    inputs=gr.inputs.Textbox(label="Enter YouTube Video ID"),
    outputs="text",
    title="YouTube Video Downloader",
    description="Enter the Video ID of a YouTube video to download it to the 'luna yt downloads' folder."
)

# Save the interface to a file
interface.launch()

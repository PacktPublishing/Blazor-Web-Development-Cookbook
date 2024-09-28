namespace BlazorCookbook.App.Client.Chapters.Chapter06.Data;

public sealed class FileStorage
{
    public Task UploadAsync(Stream stream, CancellationToken token = default)
    {
        Console.WriteLine("File uploaded!");
        return Task.CompletedTask;
    }
}

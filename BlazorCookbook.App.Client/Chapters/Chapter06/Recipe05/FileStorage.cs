namespace BlazorCookbook.App.Client.Chapters.Chapter06.Recipe05;

internal sealed class FileStorage
{
    public Task UploadAsync(Stream stream, CancellationToken token = default)
    {
        Console.WriteLine("File uploaded!");
        return Task.CompletedTask;
    }
}

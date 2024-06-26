namespace BlazorCookbook.App.Client.Chapters.Chapter09.Data;

internal static class Source
{
    public static async Task<Guid> LoadAsync(CancellationToken cancellationToken)
    {
        try
        {
            Console.WriteLine("Task starting...");
            await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            Console.WriteLine("Task completed.");
            return Guid.NewGuid();
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("Task gracefully cancelled.");
        }
        return Guid.Empty;
    }
}
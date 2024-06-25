namespace BlazorCookbook.App.Client.Chapters.Chapter09.Data;

internal static class DataSource
{
    public static async Task SaveAsync(Ticket ticket, CancellationToken cancellationToken)
    {
        try
        {
            Console.WriteLine("Task starting...");
            await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            Console.WriteLine("Task completed.");
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("Task gracefully cancelled.");
        }
    }
}
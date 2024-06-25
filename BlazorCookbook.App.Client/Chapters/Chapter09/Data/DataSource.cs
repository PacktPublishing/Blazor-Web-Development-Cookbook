using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;

namespace BlazorCookbook.App.Client.Chapters.Chapter09.Data;

internal static class DataSource
{
    public static readonly IComponentRenderMode InteractiveWebAssemblyNoPreprender
        = new InteractiveWebAssemblyRenderMode(prerender: false);

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
namespace BlazorCookbook.App.Client.Chapters.Chapter05.Recipe04;

public class OverlayState
{
    public event Func<bool, Task> OnChanged;

    public async Task ExecuteAsync(Func<Task> job)
    {
        await OnChanged.Invoke(true);

        await job.Invoke();

        await OnChanged.Invoke(false);
    }
}
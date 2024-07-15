namespace BlazorCookbook.App.Client.Chapters.Chapter10.Data;

public class ClaimViewModel
{
    public string Event { get; set; }
    public string Date { get; set; }
    public CustomerViewModel Customer { get; set; } = new();
}

public class CustomerViewModel
{
    public string Name { get; set; }
    public string Email { get; set; }
}

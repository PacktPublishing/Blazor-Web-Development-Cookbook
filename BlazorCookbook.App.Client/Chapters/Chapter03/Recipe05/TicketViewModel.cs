using BlazorCookbook.App.Client.Chapters.Chapter03.Data;

namespace BlazorCookbook.App.Client.Chapters.Chapter03.Recipe05;

internal sealed class TicketViewModel(Ticket model)
{
    public Ticket Model { get; init; } = model;

    private bool _isExpanded;
    public void Expand() => _isExpanded = true;
    public void Collapse() => _isExpanded = false;

    public string DetailsStyle
        => $"display: {(_isExpanded ? "block" : "none")};";
}
